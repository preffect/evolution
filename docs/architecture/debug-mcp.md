# Evolution — Architecture: debug MCP surface

§8 of the split [`ARCHITECTURE.md`](../ARCHITECTURE.md), which keeps the shared context and the file list.

## 8. Debug MCP surface (#14)

`GameModule` gains the optional `getDebugHandle(): SimulationDebugHandle`
(`game/debug/simulation-debug-handle.ts`); the room exposes it as `GameRoom.getDebugHandle()`
and the handlers in `mcp/handlers/` reach it through the one shared lookup
(`handlers/capability-tool.ts`), only translating arguments and serialising results. Every
member of the handle is an optional **capability**: a tool whose capability the module does not
implement answers `isError` "not supported by this game module" instead of stubbing behaviour
(the echo module implements only the bot pair; the Evolution module implements all). The optionality is
for the template only: the Evolution handle is declared `implements Required<SimulationDebugHandle>`
so `tsc` checks completeness (a forgotten member is a type error, never a runtime "not
supported"), and the Evolution module never wires `DebugContext.getRoomGameState`; there is one
path to the full state, and the inspector fallback below is template compatibility only. A
refused request
(unknown player, unknown kind, a balance path that is not a number leaf) is a
`DebugRequestError`, which the lookup turns into an `isError` result. This table is the one home
of the tool names (the `_room` suffix marks the tools that act on the room loop rather than the
world; they need no capability):

| Tool                                                                                        | Handle method                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `debug_get_game_state(gameId)`                                                              | `GameRoom.getFullState()`: the module's `serializeFullState()`, no handle member. Built for no viewer, so `ownProgress` is `null` there (architecture/wire-contract.md §4.1); one player's progress is `debug_get_player_progress`                                                                                                     |
| `debug_get_player_progress(gameId, playerId)`                                               | `getPlayerDebugState(playerId)`: progress (with the player's stage and owned traits), the cell view, modifiers, the offer queue, the input rejections, and `engulf` (the carried offset, the spit-out refractories and the last release with its reason — the one place a release reason can be read back, ecology/absorption.md §6.1) |
| `debug_get_entities(gameId, kind?, bbox?)`                                                  | `listEntities(filter)`                                                                                                                                                                                                                                                                                                                 |
| `debug_grant_dna(gameId, playerId, dna, tags?)`                                             | `grantDna(playerId, grant)` (logged)                                                                                                                                                                                                                                                                                                   |
| `debug_spawn(gameId, kind, x, y, params)`                                                   | `spawn(request)` through the spawner                                                                                                                                                                                                                                                                                                   |
| `debug_set_player(gameId, playerId, mass?, level?, traits?, position?)`                     | `setPlayer(playerId, patch)` (logged)                                                                                                                                                                                                                                                                                                  |
| `debug_pause_room(gameId)` / `debug_step_room(gameId, ticks)` / `debug_resume_room(gameId)` | `pause()`, `step(ticks)`, `resume()` on the room loop                                                                                                                                                                                                                                                                                  |
| `debug_set_seed(gameId, seed)`                                                              | `reseed(seed)`: rebuilds the streams (`determinism/random-streams.md §3`)                                                                                                                                                                                                                                                              |
| `debug_get_balance(gameId)` / `debug_set_balance(gameId, patch)`                            | `getBalance()` / `patchBalance(patch)` + `balance_updated`                                                                                                                                                                                                                                                                             |
| `debug_get_state_hash(gameId)`                                                              | `computeStateHash()`                                                                                                                                                                                                                                                                                                                   |
| `debug_export_replay(gameId)`                                                               | `exportReplay()` (`ReplayRecorder.export()`)                                                                                                                                                                                                                                                                                           |
| `debug_spawn_bot(gameId, behavior, seed?, preyPlayerId?)`                                   | `spawnBot(request, seat)`: a synthetic player the module drives (`testing/bots-and-design-tables.md §8.3`)                                                                                                                                                                                                                             |
| `debug_remove_bot(gameId, playerId)`                                                        | `removeBot(playerId)`; refuses a player the module did not spawn                                                                                                                                                                                                                                                                       |

`debug_get_game_state` returns the template's `DebugContext.getRoomGameState(gameId)` inspector when
the init step wired one, else `GameRoom.getFullState()`: the module's own `serializeFullState()`, the
same `{ snapshot, balance }` that `game_state` sends a joining client. The handle has no second
full-state member, so the Evolution module cannot implement two shapes of one fact.
`patchBalance` applies `applyBalancePatch` (`game/debug/balance-patch.ts`): number leaves only,
at paths that exist, validated as a whole before anything is written.

The room loop tools: `pause` makes the room ignore ticker fires; `step(ticks)` pauses a running
room and runs exactly `ticks` steps (each broadcast; at most `secondsToTicks(DEBUG_STEP_MAX_SECONDS)`,
converted at the tool's schema, the constant itself stays in seconds); `resume` discards the wall
time that passed while paused (`FixedStepAccumulator.discardElapsed()`), so a resumed room never
bursts to catch up. `runTick` broadcasts every `SNAPSHOT_EVERY_TICKS` ticks and `step()` always
ends with a broadcast regardless of cadence, or a `debug_step_room(1)` screenshot would show a
stale frame. That trailing broadcast goes through `SnapshotBacklog.nextFor` like any other (#274),
so a connection over the limit is sent nothing and can still be left on a stale frame; a paused
room's client is normally current, so this is theoretical rather than seen. `GameRoom.getTickCount()` is the room's own step counter, the `tick` these tools
report even for a module without a world tick. **Every mutating tool republishes the frame** (#236):
a tool registered with `isWorldMutation` (`debug_spawn`, `debug_grant_dna`, `debug_set_player`,
`debug_set_balance`, `debug_set_seed`, `debug_spawn_bot`, `debug_remove_bot`) calls
`GameRoom.republishSnapshot()` after its handle method succeeds, a `game_snapshot` at the current
tick without a step, so a paused room shows the patched world at once and the stage that
`debug_get_player_progress` reports is the stage the client draws. The client's `SnapshotBuffer`
takes a snapshot at its latest tick as a replacement (a republished frame), not as a stale one, and
the tick estimator is not re-observed for it (§5); a refused request republishes nothing.

**Bots (#15).** The decision stack is production code under `game/bots/` (the strategy seam,
perception, the strategies, the catalogue, identity, pilot, binding and the in-process roster);
only the wire client lives in `testing/bot-client/`. `behavior` is validated once, by the tool's
`z.enum(BOT_STRATEGY_NAMES)` schema, so the handle and the roster only ever see a `BotStrategyName`.
`spawnBot(request, seat)` builds a `BotPilot` on that strategy from `createInProcessBotRoster(binding)`
(`game/bots/in-process-bots.ts`), mints its `SpawnedBot` identity (`sim_bot_<seed>_<index>`,
`Bot <index>`, an avatar: a prefix of its own, so it can never take a wire bot's `bot_<seed>_<index>`
seat even from the same seed), then calls `seat(bot)` BEFORE adding the player to the module. The
tool passes `GameRoom.addSyntheticPlayer` as `seat`: it refuses an id already in the roster or on a
socket with `DebugRequestError` (the module then holds nothing), else enrols the bot and broadcasts
`player_joined` like a late join, with no connection; `config.maxPlayers` is deliberately not
applied to a debug spawn. `removeBot` mirrors it: the module forgets the player,
`GameRoom.removeSyntheticPlayer` (which refuses a player with a live socket) drops it from the
roster and broadcasts `player_disconnected`. The module drives its roster at the top of
`reduceGameState` (`bots.driveTick(snapshot, tick, submitInput)`, before step 1 applies pending
input), so a bot's input for tick `t` is decided from the snapshot of `t − 1` and stamped
`sequence = t`, exactly as a wire client's would be. The echo module wires the roster over the
echo binding; the Evolution module (#152/#98) wires it over the Evolution binding and never spawns a
bot any other way. Wild cells (#156) are not synthetic players and never go through the roster:
they are world entities the simulation drives with the same strategies through an entity-id
`ownCellOf`.
