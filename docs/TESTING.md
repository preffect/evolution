# Evolution — Testing Standards

The bar every PR is reviewed against (#76). `ENGINEERING.md` §2 gives the principles; this
document gives the tiers, the file rules, the builders and the coverage numbers the gate
enforces. Placement rules are `CODE-STANDARDS.md` §10; the determinism rules every test obeys
are `DETERMINISM.md`.

## 1. The tiers

| Tier            | Proves                                                                           | File                                                             | Runs in                                     | Required when                                                     |
| --------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| **Unit**        | one pure function, class or module in isolation; no I/O; < 100 ms                | `foo.test.ts` beside `foo.ts` (client `foo.spec.ts`)             | `./validate.sh test` (part of `all`)        | always: every function, formula, modifier, schema, reducer branch |
| **Integration** | a wire between subsystems: room + module + router, `/ws` over a real socket pair | `foo.integration.test.ts` / `.integration.spec.ts`               | `./validate.sh integration` (opt-in)        | any change that crosses a subsystem boundary                      |
| **Gameplay**    | a rule or a balance number, as a scenario on a fixed seed (section 8)            | `packages/server/src/testing/scenarios/<table>.gameplay.test.ts` | `./validate.sh integration` (opt-in)        | any change to rules, tunables or the step order                   |
| **UI**          | a component renders and dispatches; a critical flow works end to end             | `*.spec.ts` (component); Playwright smoke                        | `./validate.sh test`; smoke by the QA roles | HUD, prompts, lobby and any critical flow                         |

A unit test that needs a server, a socket or a browser is an integration test with the wrong
name: rename it rather than slowing the unit tier (`ENGINEERING.md` §2.2). Gameplay scenarios
build a world, step N ticks, assert values and the state hash on the framework of section 8; one
file per design table, tests named by row id (`E9`, `P3`, `T4`, `G2`). A single row is cheap,
but a table steps the real module for thousands of ticks (G2 runs 37 200), so the tier runs with
the opt-in integration run rather than on every save.

## 2. How the tiers are selected

- `vitest.tiers.ts` at the repo root is the one place the globs live; every package's
  `vitest.config.ts` spreads `testTierOptions()` and `coverageOptions(thresholds)` from it.
- Default runs include `src/**/*.test.ts` and exclude `*.integration.test.ts` and
  `*.gameplay.test.ts`. Each package's `test:integration` script (`RUN_INTEGRATION=1 vitest run`;
  the client's `ng run client:test-integration`) flips to the opt-in globs (integration plus
  gameplay), with `passWithNoTests` so a package without any yet still passes. The gameplay
  suffix is its own glob (`GAMEPLAY_TEST_GLOBS`) rather than a third command: the scenarios are
  run at the same moment as the integration tests (the end of a task), and one opt-in run is one
  thing to remember; the distinct suffix keeps them selectable (`vitest run src/testing/scenarios`)
  and lets a later ticket split the command without renaming a file.
- The client's `test` target in `angular.json` excludes `**/*.integration.spec.ts`; its
  `test-integration` target includes only them.
- Run the integration tier at the end of a task that may have caused a cross-subsystem
  regression, never on every save.

## 3. Naming and placement

- Co-located, same basename: `game-room.ts` → `game-room.test.ts`. No `__tests__/` directories.
- `describe` names the unit (`'PerformanceTracker'`, `'debug_get_room'`); `it` states one
  behaviour in the present tense: `it('drops an input whose sequence is not newer', …)`.
- One behaviour per test. Assert values and hashes; never snapshot a large object, never
  assert object identity on the in-place simulation state (`ARCHITECTURE.md` §3.1).
- A test that needs randomness seeds it (`createSeededRandom(TEST_SEED)`); a test that needs
  time uses `ManualClock` or vitest fake timers. `Math.random`, `Date.now` and
  `performance.now` are lint-banned in tests too (`CODE-STANDARDS.md` §8).

## 4. Builders, not fixture files

Each package keeps its test doubles in `src/testing/`:

| Package  | File                         | Provides                                                                                                                                                                                                                                                                                                                   |
| -------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server` | `testing/builders.ts`        | `createTestConnection`, `createSpyGameModule`, `createDebugCapableGameModule(handle)`, `createManualRoomTiming` (`ManualClock` + `ManualTicker`), `createTestLobby(options)`, `createTestDebugContext`, `createActiveRoomFixture` (a started room + tool capture), `createToolCapture` (invoke MCP tools), `parseToolJson` |
| `server` | `testing/gameplay/` (#75)    | the scenario runner of section 8: `createScenarioDsl`, `player`, the scripts, the fixture helpers, replay and the echo adapter; `strategies/` holds the bots of section 8.4                                                                                                                                                |
| `server` | `testing/bot-builders.ts`    | `createTestScriptContext`, `createTestBotCell`, `createTestWorldView`, `createTestPerception`, `createTestBotIdentity`, `createFakeBotTransport`, `createFakeSocket`, `captureManualTimings` (section 8.4)                                                                                                                 |
| `server` | `testing/socket-builders.ts` | `startTestWebSocketServer` (Fastify + `/ws` on an ephemeral port over any module and timing), `openTestSocket`, `nextServerMessage`, `whenClosed`; integration tier only                                                                                                                                                   |
| `client` | `testing/fake-websocket.ts`  | `FakeWebSocket`: install with `vi.stubGlobal('WebSocket', FakeWebSocket)`, then `open()` / `receive()` / `close()` from the test                                                                                                                                                                                           |
| `shared` | `testing/builders.ts`        | `createTestSessionConfig`, `createTestGameInput`, `createTestSnapshot` (the wire contract, exported from the package so server and client tests share one shape); `createTestCell`, `createTestWorld` join with #98                                                                                                        |

Rules: builders take a partial and fill defaults (`createTestCell({ mass: 40 })`); builder
defaults are the only tolerated inline test numbers; a shape change is one edit in the
builder. The test doubles (`testing/builders.ts`, `testing/fake-websocket.ts`, the scenario tables
under `testing/scenarios/`) are excluded from coverage and from `jscpd`; the gameplay framework
under `testing/gameplay/` is logic and is measured like any other source.

## 5. Coverage thresholds

`./validate.sh test` runs `@vitest/coverage-v8` (shared, server) and the Angular unit-test
builder's coverage (client) and **fails below the thresholds** in each package's config:

| Package  | Target (lines / branches / functions / statements) | Where                                                              | Today                      |
| -------- | -------------------------------------------------- | ------------------------------------------------------------------ | -------------------------- |
| `shared` | 95 %                                               | `packages/shared/vitest.config.ts`                                 | 100 % lines                |
| `server` | 90 %                                               | `packages/server/vitest.config.ts`                                 | 94 % lines, 96 % branches  |
| `client` | 80 %                                               | `packages/client/angular.json` → `test.options.coverageThresholds` | 100 % lines, 82 % branches |

- Thresholds are floors that only move up: raise them in the same PR that raises coverage,
  never lower them to land a change.
- A new package starts at its target from its first PR.
- Excluded from measurement (they are not logic): `**/index.ts` barrels and composition roots,
  `src/main.ts`, `src/app/app.config.ts`, the test doubles (`src/testing/builders.ts`,
  `src/testing/fake-websocket.ts`, `src/testing/scenarios/**`), `*.d.ts`, and the tests themselves. The
  gameplay framework under `src/testing/gameplay/` is logic and is measured (`vitest.tiers.ts`).
  Nothing else is excluded; a hard-to-test file is split, not hidden.
- Integration runs do not measure coverage; they prove wiring.

## 6. Flaky tests

A test that fails intermittently is a bug in the test or a determinism bug in the code, never
"just flaky". Do not retry, `.skip` or loosen it. Find the shared state, the unseeded draw or
the wall-clock read; a hash mismatch in a simulation test is bisected by hashing every tick
(`DETERMINISM.md` §7). `./validate.sh all` runs with no retries so a flake surfaces immediately.

## 7. Definition of tested (what a reviewer checks, with `file:line`)

1. Every new function or branch has a unit test for the happy path, the edges and the error.
2. A new wire (message, MCP tool, socket handler, room hook) has an integration test.
3. A changed rule or number has a scenario named by its design-table row.
4. Fixtures come from `src/testing/`; no ad-hoc object literals repeated across tests.
5. No `.only`, no `.skip`, no snapshot of a large object, no `Math.random`, no real time.
6. Coverage did not go down; if it went up, the threshold went up with it.

## 8. Gameplay tier: the scenario runner (`packages/server/src/testing/gameplay/`, #75)

The design tables (`ECOLOGY.md` §8, `GAME-DESIGN.md` §13, `PROGRESSION.md` §7, `TRAITS.md` §6)
read "given seed S and inputs I, after N ticks assert X". The runner turns one row into one test
without a server, a socket or a browser: it builds the room's `GameModule` the way the lobby
would, drives it under a `ManualClock` through the production `FixedStepAccumulator`
(`DETERMINISM.md` §2; never wall time, bursts capped at `MAX_TICKS_PER_ADVANCE`, the clock
positioned at the absolute time of each burst's last tick so no float residue accumulates),
feeds joins, leaves, scheduled fixtures and scripted inputs before the step they apply in,
hashes the state at checkpoints and evaluates every expectation at its tick. The framework
knows nothing about the game: a `ScenarioAdapter` (`adapter.ts`) tells it how to create the
module, read a snapshot, hash the state, turn a command into the wire input, find a player's
cell and place a fixture. `echo-adapter.ts` serves the template's echo module today; #98 adds
the Evolution adapter, and the scenario tables (#102) import that binding.

### 8.1 Writing a scenario

```ts
// packages/server/src/testing/scenarios/ecology.gameplay.test.ts
import { createDecayedHelper, insideCellOf, player, targetRadiiEast } from '../gameplay/index.js';
import { evolutionScenario as scenario, massOf } from '../gameplay/evolution-adapter.js'; // #98

const decayed = createDecayedHelper({ cellStartingMass: ..., massDecayRatePerSecond: ... }); // from DEFAULT_BALANCE

it('E9: A absorbs B on tick 30', () => {
  scenario('E9')
    .seed(42)
    .players(2)
    .placeCell({ playerIndex: 0, mass: 100 })                          // broth point (1500, 0)
    .placeCell({ playerIndex: 1, mass: 20, eastOfFirstCellWu: 10 })    // east of A, centres 10 wu apart
    .advance(30)
    .expect('A mass', (view) => massOf(view, 0)).atTick(30).toBeCloseTo(decayed(100, 30) + 16, 0.01)
    .expect('B spectating', (view) => view.snapshot.players[view.playerId(1)]?.lifeState).atEnd().toBe('spectating')
    .runDeterministic();
});
```

- **Seed and roster.** `.seed(S)` is required; `.players(n)` (a whole number ≥ 1) gives indices
  `0 … n − 1` present from tick 0 (ids `player_<index>`, names `Player <index>`).
  `.playerJoinsAt(tick)` adds a late joiner (its index is the count before the call, G9/P7);
  `.playerLeavesAt(tick, index)` removes one before that step (G10: the fixture drives the room's
  grace timer) and must come after the join. `.config({...})` overrides the session config.
- **Placement.** `.placeCell`, `.placeMote` and `.placeFragment` follow `ECOLOGY.md` §8
  (`fixtures.ts`, `placement.ts`): the first cell sits at the broth point, anything after it is
  placed `eastOfFirstCellWu` (the row's centre distance) or at an explicit `at`. `at` is an
  **anchor**, resolved by the adapter once the world exists: a bare `{ x, y }`, a zone
  (`ZONE.broth`, `ZONE.vent`, `ZONE.shallows`), `insideCellOf(i)` (E12, E15, P2),
  `eastOfCellOf(i, wu)` (E4 against a seeded cell) or `gelPatchCentre(n)` (E8). A cell takes
  `isPinned`, `traits` (`'cilia'` is tier I, `{ traitId: 'nucleoid', tier: 2 }` names the tier,
  TRAITS §2) and `dnaCumulative` (P7, P10: "level 12 with fixture DNA 1760"). A setup placement
  applies before tick 1; **`.atTick(T).placeMote(...)`** schedules the same record to apply
  between tick T − 1 and tick T, after that tick's joins and leaves and before its scripts
  (E13–E16, P2, P6, P7, P11: "one bacterium inside the cell per tick for 10 ticks" is ten
  `.atTick(t).placeMote(...)` calls). Scheduled fixtures are recorded in the replay as
  `patches`. Placing anything means the adapter disables the initial fill and both spawners for
  that run, and fails the scenario when a seeded gel patch lies within `GEL_PATCH_CLEARANCE_WU`
  of the broth point (`isClearOfGelPatches`; pick another seed, never tolerate it).
- **Inputs.** "At tick T" means submitted between tick T − 1 and tick T, so step T applies it
  (inputs apply at tick boundaries; tick 0 is the initial state, so inputs start at tick 1).
  `.atTick(T, player(i).does(script))` fires once; `.from(T, …)` every step from T;
  `.between(T1, T2, …)`; `.every(n, …, fromTick)` re-evaluates every n ticks ("greedy bot,
  re-evaluated every 30 ticks"). A window must start while its player is in the room and must
  not claim ticks after they leave (`build()` rejects it); an open window simply stops feeding a
  player who has left. Scripts (`scripts.ts`) see the state before the step and answer a
  `PlayerCommand`: `targetPoint`, `targetRadiiEast(n)` (measured from the _current_ centre every
  tick, the convention), `targetRadiiAwayFrom`, `sprint()`, `chooseTrait({ offerId, cardIndex })`,
  `command({...})`, `idle`, and `combineScripts([...])` for "sprint + target 5 radii east". A
  cell-relative script whose player has no cell this tick (absorbed, spectating, the tick it
  joins) sends nothing; an adapter with no world (echo) throws instead. Commands for one player
  in one tick are merged (later fields win; the sprint flag and the trait pick are OR-merged,
  `ARCHITECTURE.md` §3.2) and the adapter stamps the sequence.
- **Bots.** `.bot(index, factory, everyTicks)` drives a player from a `BotStrategy` built by
  `factory` (`bots.ts`): the interface the `idle` / `wander` / `grazer` / `hunter` strategies of
  section 8.4 implement and the headless bot client reuses. The schedule holds the **factory**, not an
  instance: every run (both runs of `runDeterministic`) gets a fresh strategy, so a strategy may
  keep state across its decisions. Its only other input is `ScriptContext`, and its only source
  of randomness is `context.random`, a stream forked from the scenario seed per player
  (`scenario_player_<index>`): a strategy that draws from anywhere else, or a factory that
  returns a shared instance, diverges on the second run. A bot starts deciding at tick 1 or at
  its join tick. `createScriptedStrategy(name, script)` wraps a pure script as a factory.
- **Time.** `.advance(ticks)` accumulates the run length; `.hashEvery(n)` sets the checkpoint
  cadence (default 600; tick 0 and the final tick are always checkpoints).
- **Assertions.** `.expect(label, selector).atTick(T)` or `.atEnd()` then `.toBe`, `.toEqual`,
  `.toBeNull`, `.toBeCloseTo(value, tolerance)` ("± 0.01" in the tables), `.toBeLessThan`,
  `.toBeGreaterThan`, `.toBeAtLeast` ("≥ 5"), `.toBeAtMost`, `.toBeBetween(low, high)`
  (inclusive, "between 70 and 74") or `.toSatisfy(predicate, description)` for anything else,
  where `description` is exactly what the failure prints, so it carries the bound and the unit
  ("between 70 and 74 motes"). A selector gets a `ScenarioView`: `tick`, `seed`, `snapshot`,
  `playerId(index)`, `cell(index)` and `captured(label)`. A selector that yields `undefined` (a
  cell that is gone, `?.lifeState` on a missing player) fails every matcher with `got undefined`;
  `toBeNull` accepts `null` only. Failures are collected, not thrown one at a time: `.run()`
  throws one `ScenarioAssertionError` listing every miss.
- **Captures.** `.capture(label, selector).atTick(T)` stores the selected value before that
  tick's expectations run; a later selector reads it as `view.captured(label)` (G10: detritus
  mass from the cell's mass at tick 2399; G7: the speed cap from the mass at that tick). Reading
  a label not captured yet yields `undefined` and fails the expectation.
- **Run.** `.run()` executes once and returns the replay, the final snapshot and hash and the
  checkpoints. `.runDeterministic()` runs twice and throws `ScenarioDivergenceError` at the first
  checkpoint the runs disagree on; every table row uses it, so a rule that reads the wall clock or
  an unseeded draw fails the row that exercises it.

**Table wording → tick stamp.** Expectation and script ticks are absolute across accumulated
`.advance()` calls, and `build()` throws `ScenarioSetupError` for anything stamped past the last
advanced tick (an expectation, a capture, a script window, a join, a leave, a scheduled
fixture): a test that could never fail is not a test. So "After N ticks" is the run length and
must cover the largest assertion tick (G7 says "After 2 ticks" but asserts at 31, 100 and 181:
`.advance(181)`). "Joins before tick 6000 steps" is `playerJoinsAt(6000)` and "join + 1" is
`.atTick(6000)` (P7's 99.997 is one decay tick after placement, so join + 1 _is_ 6000). "The
fixture calls `removePlayer` at tick 2400" is `playerLeavesAt(2400, i)`; the cell's last
observable state is tick 2399 (capture it there). "Fixture sets A.mass = 23 before tick 10" is
`.atTick(10).placeCell({ playerIndex: 0, mass: 23 })`. "Idle" is no script at all.

### 8.2 Replay and the failure output

Every run records a `ScenarioReplay` (`replay-format.ts`): seed, config, setup fixtures, the
tick-0 roster, every join and leave, every scheduled fixture (`patches`) and every applied input
stamped with the tick it was applied in, plus the hash checkpoints. `verifyReplay(replay,
adapter)` rebuilds a fresh module from the record, buckets the log by tick once (a replay costs
the run plus the log, never the log per tick) and must reproduce every checkpoint;
`replayScenario` returns the verdict without throwing. A replay never calls a script or a
strategy: it feeds the recorded inputs. A failing `.run()` writes the replay through the adapter
binding's sink, by default `qa/replays/<scenario-slug>.replay.json` (gitignored), and the error
names it. The output always carries what reproduces the failure:

```text
Scenario "E9" failed (seed 42):
  at tick 30: A mass
    expected 115.92003865463975 ± 0.01, got 110.4 (off by 5.52)
  replay written to /workspace/qa/replays/e9.replay.json

Scenario "E9" diverged (seed 42): first differing checkpoint at tick 600: expected 1f3a…, got 9c0e… (identical through tick 0)
```

`toBeCloseTo` prints the expected value as computed and "off by" rounded to the tolerance's
decimals. A divergence is bisected by lowering `.hashEvery(1)` on that scenario: the report then
names the exact tick (`DETERMINISM.md` §7). To run one scenario file on its own (the gameplay
tier is opt-in and `./validate.sh integration` runs every package), filter the server package
directly:

```bash
pnpm --filter @evolution/server test:integration ecology   # every *.gameplay.test.ts whose path contains "ecology"
```

A framework test never uses the file sink: pass `createMemoryReplaySink()` to
`createScenarioDsl(adapter, { replaySink })`.

### 8.4 Bots: strategies, the headless bot client and `debug_spawn_bot` (#15)

Agents cannot open a second human's browser, so opponents are bots: the same `BotStrategy` runs
in a scenario (section 8.1), over the wire against a running server, or inside the game module.

**Strategies** (`packages/server/src/testing/gameplay/strategies/`) are pure over the
`ScriptContext` and a `BotPerception`; the only randomness they may draw is `context.random`.

| Name                           | Behaviour                                                                                                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idle`                         | Never sends an input: a warm body in the roster.                                                                                                                                                                                         |
| `wander`                       | A seeded random walk: the heading drifts by a gaussian turn (`WANDER_TURN_SIGMA_RADIANS`) and the bot aims `WANDER_STEP_WU` ahead, from its cell's centre when it has one.                                                               |
| `grazer`                       | Aims at the nearest mote every decision; sends nothing without a cell or without food.                                                                                                                                                   |
| `hunter`                       | Commits to the largest cell it can engulf (the shared `canEngulf`, ECOLOGY §6.1) until it is gone or no longer engulfable, then picks again; sprints within `HUNTER_SPRINT_WITHIN_RADII` radii. `preyPlayerId` narrows it to one player. |
| `createScriptSequenceStrategy` | Scripted: a list of `scripts.ts` steps, each owning a number of decisions, optionally looping; code only, no catalogue name.                                                                                                             |

`createStrategyByName(name, perception, { preyPlayerId })` is the catalogue the CLI and
`debug_spawn_bot` resolve a string through; `BOT_STRATEGY_NAMES` is the list a wrong name is
told. `BotPerception` (`perception.ts`) is what a strategy sees beyond its own cell: `cellsOf`,
`motesOf` and `canEngulf(predator, prey)`, the shared predicate already closed over the live
`balance.absorption`, so no bot carries its own ratio rule. A `BotWorldBinding`
(`bot-client/bot-binding.ts`) adds the adapter duties, `locateCell` and `toInput`; the echo
binding sees nothing and locates nothing, so on the echo module `grazer` and `hunter` hold and
`wander` and `idle` are the strategies that show anything. #98 adds the Evolution binding.

**Determinism.** Every bot is a `BotPilot` (`bot-client/bot-pilot.ts`) on its own stream,
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

Each bot opens its own socket as `?clientId=bot_<seed>_<index>` (a rerun with the same seed
takes the same seats), sends `join_lobby` as `Bot <index>` and `join_game`, and is seated by
the `game_state` of a late join or the `game_started` of a pending game. From then on it runs
one client tick per fixed step through the injected `Clock` + `Ticker` (docs/ARCHITECTURE.md §5:
one `player_input` per tick, `sequence` = tick), deciding from the latest snapshot; it holds
until the first snapshot arrives. The CLI is the only composition root that names the system
pair; the integration test drives two bots against a real in-process server for 300 ticks on
manual clocks, every tick strictly ordered (bots decide, inputs land, the room steps and
broadcasts), and checks the echoed inputs against an offline pilot with the same seed. A game
the server refuses (`Game not found`, `Game is full`) rejects `start()` with a `BotClientError`
and stops every bot. Stats per bot: `clientTick`, `decisions`, `inputsSent`, `snapshotsReceived`,
`droppedTicks`, `errorsReceived`, `lastError`.

**In-process** (`debug_spawn_bot(gameId, behavior, seed?, preyPlayerId?)` /
`debug_remove_bot(gameId, playerId)`, docs/ARCHITECTURE.md §8): the game module drives the bot
itself from a `createInProcessBotRoster(binding)` and the room enrols it as a synthetic player,
so the lobby and the other clients see a normal `Bot <index>`. The 4-cell dish a QA screenshot
needs is one room and three `debug_spawn_bot` calls; `debug_pause_room` + `debug_step_room`
then freeze the frame.

**Test doubles:** `testing/bot-builders.ts` (strategy contexts and world views, a fake transport,
a fake socket, captured manual timings) and `testing/socket-builders.ts` (a listening server on
an ephemeral port and the raw `ws` promises) are excluded from coverage like `builders.ts`.

### 8.3 Proving scenarios

`packages/server/src/testing/scenarios/echo.gameplay.test.ts` runs the framework against the echo
module: inputs echo from the tick they were applied and a late joiner is present from its step,
each hash-equal across two runs and reproduced by its replay; two more fail on purpose (a wrong
expectation, a script with an unseeded closure) and pin the failure output above. The echo
adapter hashes `JSON.stringify(serializeRoomState())` through `hashText` (`DETERMINISM.md` §7)
because the echo game has no `WorldState`; it cannot locate cells or place fixtures, and says so.
`toy-adapter.ts` is a two-rule world used only by the framework's own unit tests; its fixtures go
through the same `FixtureContext` an adapter over a world receives (`context.playerId(index)`
resolves a scenario index, so an adapter never hard-codes the DSL's id scheme).
