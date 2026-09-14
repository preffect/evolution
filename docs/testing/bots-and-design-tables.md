# Evolution — Testing Standards: bots, proving scenarios and the design tables

§8.3–§8.5 of the split [`TESTING.md`](../TESTING.md), which keeps the shared context and the file list.

### 8.3 Bots: strategies, the headless bot client and `debug_spawn_bot` (#15)

Agents cannot open a second human's browser, so opponents are bots: the same `BotStrategy` runs
in a scenario (section 8.1), over the wire against a running server, or inside the game module.

**Strategies** (`packages/server/src/game/bots/strategies/`; the seam, perception and catalogue
beside them in `game/bots/`, re-exported by `testing/gameplay/strategies/index.ts` so a scenario
imports them from the framework) are pure over the `ScriptContext` and a `BotPerception`; the
only randomness they may draw is `context.random`.

| Name                           | Behaviour                                                                                                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `idle`                         | Never sends an input: a warm body in the roster.                                                                                                                                                                                                       |
| `wander`                       | A seeded random walk: the heading drifts by a gaussian turn (`WANDER_TURN_SIGMA_RADIANS`) and the bot aims `WANDER_STEP_WU` ahead, from its cell's centre when it has one.                                                                             |
| `grazer`                       | Aims at the nearest mote every decision; sends nothing without a cell or without food.                                                                                                                                                                 |
| `hunter`                       | Commits to the largest cell it can engulf (the shared `canEngulf`, ecology/absorption.md §6.1) until it is gone or no longer engulfable, then picks again; sprints within `HUNTER_SPRINT_WITHIN_RADII` radii. `preyPlayerId` narrows it to one player. |
| `createScriptSequenceStrategy` | Scripted: a list of `scripts.ts` steps, each owning a number of decisions, optionally looping; code only, no catalogue name.                                                                                                                           |

`createStrategyByName(name, perception, { preyPlayerId })` is the catalogue the CLI and
`debug_spawn_bot` resolve a name through; both validate the string at their edge
(`isBotStrategyName` in the CLI parser, `z.enum(BOT_STRATEGY_NAMES)` in the tool schema), and
`BOT_STRATEGY_NAMES` is the list a wrong name is told. `BotPerception` (`game/bots/perception.ts`)
is what a strategy sees: `ownCellOf(snapshot, playerId)`, the single self-locator (the one place
a player identity is assumed; #156's wild cells swap it for an entity-id lookup), `cellsOf`,
`motesOf` and `canEngulf(predator, prey)`, the shared predicate already closed over the live
`balance.absorption`, so no bot carries its own ratio rule. A `BotWorldBinding`
(`game/bots/bot-binding.ts`) adds `locateCell`, derived from `ownCellOf` through
`locateCellThrough` (a `CellLocation` is the cell's `x`, `y`, `radius`), and `toInput`; a
`ScenarioAdapter` extends it, so the adapter of a world IS its binding. The echo binding sees
nothing and locates nothing, so on the echo module `grazer` and `hunter` hold and `wander` and
`idle` are the strategies that show anything. The Evolution binding (`game/bots/evolution-binding.ts`)
reads the wire snapshot: every cell, the fragments while any exist else the motes (the greedy
graze of PROGRESSION §7), and `canEngulf` over the live balance.

**Determinism.** Every bot is a `BotPilot` (`game/bots/bot-pilot.ts`) on its own stream,
`bot_<index>` forked from the swarm seed, and stamps its client tick as the input `sequence`.
Two bots with the same seed and index decide the same way in-process, over the wire and in a
unit test (`bot-pilot.test.ts`, `bot-client.integration.test.ts` pin it).

**In a scenario:** `.bot(index, createGrazerStrategy(perception), everyTicks)` (section 8.1).

**Against the running game** (the headless bot client, `packages/server/src/testing/bot-client/`):

```bash
pnpm --filter @evolution/server bot-client --game <id> --bots 4 --strategy grazer --seed 42
#   --prey <playerId>    hunter only          --url ws://localhost:4400/ws
#   --ticks 600          stop after 600 client ticks and print per-bot stats as JSON (default: until Ctrl-C)
```

Each bot opens its own socket as `?clientId=bot_<seed>_<index>` (`CLIENT_ID_QUERY_PARAMETER`; a
rerun with the same seed takes the same seats), sends `join_lobby` as `Bot <index>` and `join_game`, and is seated by
the `game_state` of a late join or the `game_started` of a pending game. From then on it runs
one client tick per fixed step through the injected `Clock` + `Ticker` (docs/architecture/client.md §5:
one `player_input` per tick, `sequence` = tick), deciding from the latest snapshot; it holds
until the first snapshot arrives. The CLI is the only composition root that names the system
pair; the integration test drives two bots against a real in-process server for 300 ticks on
manual clocks, every tick strictly ordered (bots decide, inputs land, the room steps and
broadcasts), and checks the echoed inputs against an offline pilot with the same seed. A socket
that cannot open, or a game the server refuses (`Game not found`, `Game is full`), rejects
`start()` with a `BotClientError` and stops every bot that did connect. A bot whose socket closes
after it was seated stops ticking, shows `isConnected: false` and rejects whoever waits on it, so
`--ticks N` exits non-zero (stats still printed) instead of counting inputs into a closed socket.
Stats per bot: `clientTick`, `decisions`, `inputsSent`, `snapshotsReceived`, `droppedTicks`,
`errorsReceived`, `lastError`, `isConnected`.

**In-process** (`debug_spawn_bot(gameId, behavior, seed?, preyPlayerId?)` /
`debug_remove_bot(gameId, playerId)`, docs/architecture/debug-mcp.md §8): the game module drives the bot
itself from a `createInProcessBotRoster(binding)` (`game/bots/in-process-bots.ts`) and the room
seats it as a synthetic player (`sim_bot_<seed>_<index>`, a namespace no wire bot shares; an id
already in play is refused before the module holds the bot), so the lobby and the other clients
see a normal `Bot <index>`. The 4-cell dish a QA screenshot needs is one room and three
`debug_spawn_bot` calls; `debug_pause_room` + `debug_step_room` then freeze the frame.

**Test doubles:** `testing/bot-builders.ts` (strategy contexts and world views, a fake transport,
a fake socket, captured manual timings) and `testing/socket-builders.ts` (a listening server on
an ephemeral port and the raw `ws` promises) are excluded from coverage like `builders.ts`.

### 8.4 Proving scenarios

`packages/server/src/testing/scenarios/echo.gameplay.test.ts` runs the framework against the echo
module: inputs echo from the tick they were applied and a late joiner is present from its step,
each hash-equal across two runs and reproduced by its replay; two more fail on purpose (a wrong
expectation, a script with an unseeded closure) and pin the failure output above. The echo
adapter hashes `JSON.stringify(serializeRoomState())` through `hashText` (`determinism/replay-tests-and-traps.md` §7)
because the echo game has no `WorldState`; it cannot locate cells or place fixtures, and says so.
`toy-adapter.ts` is a two-rule world used only by the framework's own unit tests; its fixtures go
through the same `FixtureContext` an adapter over a world receives (`context.playerId(index)`
resolves a scenario index, so an adapter never hard-codes the DSL's id scheme).

### 8.5 The design tables

The design tables run on the Evolution adapter: `ecology-spawn.gameplay.test.ts` (E1–E3, E14),
`ecology-cells.gameplay.test.ts` (E4–E8, E12, E15), `game-design-session.gameplay.test.ts` (G1–G3,
G9–G11, G14; G2 and G11 share one whole-round run), `game-design-controls.gameplay.test.ts` (G4–G7)
and `progression.gameplay.test.ts` (P1–P3, P6–P8, P10). Two files carry the rules end to end beside
the tables (#198): `progression-trait-effects.gameplay.test.ts` (DNA eaten → level-up → a card picked
through the input → the tier I modifier changes DNA gain, the speed cap or the decay on the pick tick)
and `leaderboard.gameplay.test.ts` (score order, the mass then join-order tie-breaks of
`determinism/ordering-and-state-hash.md` §4, and a late-join gift that buys no rank). `shared-setups.ts` holds the seeds bound to
the DSL, `decayed()`, the steer-blend helpers (`blendedSpeed`, `blendedTravelWu`), the tolerances and
the P7 world G9 reuses. A row derives its expected numbers from the shared constants and formulas
(`maxSpeedForMass`, `radiusForMass`, `gelSpeedFactor`, `cumulativeDnaForLevel`, `worldReference`) rather
than copying the table's literal, so a balance change fails a row only when the rule breaks (#212). The pure-function rows are
pinned beside their functions (P4, P9, P12, P14 in `game/progression/draft.test.ts`, P13 in
`ladder.test.ts`, G12 and W1 in `shared/src/simulation/world-clock.test.ts`). The rows that need
an engulf (E9–E11, E13, E16, G8, P5, P11, the T rows) land with the engulf slice of #98; the
evolving-world rows (W2–W10, G13) with the wild-cell slice. The gameplay tier runs with
`OPT_IN_TEST_TIMEOUT_MS`: a whole-round row (G2, G11) steps 37 200 ticks twice.
