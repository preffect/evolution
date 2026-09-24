# Evolution — Deterministic Simulation Contract: replay, what the tests assert and known traps

§6–§8 of the split [`DETERMINISM.md`](../DETERMINISM.md), which keeps the shared context and the file list.

## 6. Replay (`packages/server/src/game/replay/`)

```ts
export interface Replay {
  version: number; // REPLAY_FORMAT_VERSION
  startedBy: 'world_build' | 'rematch' | 'reseed'; // REPLAY_ORIGIN: what opened the recording
  seed: number; // the round seed the recording started from
  startTick: number; // the tick counter continues across a rematch
  nextEntityNumber: number; // the entity counter the round's world was built from (a rematch continues it)
  config: GameSessionConfig;
  balance: BalanceConfig; // the numbers the run used, so a live-tuned room still replays
  roster: readonly PlayerIdentity[]; // who was present when the recording started, in join order
  membership: readonly ReplayMembershipEvent[]; // { tick, kind: 'join' | 'leave', playerId, playerName, avatarIndex }
  inputs: readonly ReplayInput[]; // { tick, playerId, input } — the coalesced input applied at that tick
  debugPatches: readonly ReplayDebugPatch[]; // debug_spawn / debug_grant_dna / debug_set_balance, stamped by tick
  finalTick: number;
  finalHash: StateHash;
}
export const replay: (recording: Replay) => { world: WorldState; hash: StateHash };
```

- `ReplayRecorder` sits inside the module: joins, leaves, applied inputs and debug patches are
  stamped with the tick at which they were **applied**, so the log is exactly what the
  simulation saw (not what arrived). The input log is in tick order, so recording a tick drops and replaces only
  its tail (the entries an export between ticks already stamped for the coming tick); walking the whole log each
  tick cost in proportion to the room's age (#181).
- **One replay = one round.** The auto-rematch and `debug_set_seed` end the current recording
  and start a new one from the new seed, marked by `startedBy`; a replay never spans a reseed. The
  rematch round closes at the rematch tick with the rebuilt world's hash (the reset happens inside
  that step); a reseed closes with the hash of the tick before the streams were rebuilt. A recording
  opened by a world build or a rematch replays from scratch; one opened by a `debug_set_seed`
  records a world that kept running with rebuilt streams, so it is exported for inspection and
  diffing and `replay()` refuses it (`ReplayOriginError`).
- `replay()` builds a fresh world from `seed + config + balance + roster + nextEntityNumber`, feeds
  the log tick by tick, then the events stamped for the tick after the last one (what was pending
  when the recording was exported: they are already in `finalHash`), and returns the final world
  and hash; callers assert `hash === recording.finalHash`.
- Within one tick the log replays membership, then debug patches, then inputs, not arrival order:
  a debug tool used in the same tick window as a join can change that join's entry (§8, #180).
- Failing gameplay scenarios write their replay to `qa/replays/<scenario>.replay.json`;
  `debug_export_replay` exports a live room.
- Two record shapes coexist on purpose: the module's `Replay` (rooms, `debug_export_replay`) and
  the scenario runner's `ScenarioReplay` (`packages/server/src/testing/gameplay/replay-format.ts`:
  seed, config, setup fixtures, membership, scheduled fixtures as `patches` and inputs stamped by
  applied tick, hash checkpoints), which `verifyReplay` replays through the adapter (`testing/scenario-runner.md`
  §8.2). A scenario's fixtures are harness-level writes no module log records; the two share only
  `indexByTick`.

## 7. What the tests assert

| Test (file)                                             | Asserts                                                                                                                                                                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `random/seeded-random.test.ts`                          | same seed ⇒ same sequence; forks independent; same label ⇒ same fork; `createSeededRandomFromState(getState())` continues identically                                                                      |
| `random/xoshiro128-star-star.test.ts`                   | known answers: the reference sequence from state {1, 2, 3, 4}; splitmix32 expansions of seeds 0 and 42; outputs stay unsigned 32-bit                                                                       |
| `random/determinism.integration.test.ts`                | streams + `ManualClock` + accumulator + hash on a toy world: two 10 000-tick runs of seed 42 hash equal every 600 ticks; seed 43 differs                                                                   |
| `time/fixed-step-accumulator.test.ts`                   | due ticks for exact, partial and stalled advances; cap applied and dropped ticks reported; 600 fractional intervals owe one tick each                                                                      |
| `simulation/state-hash.test.ts`                         | equal worlds hash equal; any hashed field change or reorder changes the hash; NaN throws; every non-derived field is in `HASHED_FIELDS`                                                                    |
| `determinism-guard.test.ts` (shared, package root)      | no `Math.random` / wall clock / timers in `packages/shared/src` outside `random/` and `time/` (code only, comments ignored)                                                                                |
| `game/evolution-module.determinism.integration.test.ts` | two rooms, same seed, same scripted inputs under `ManualClock` ⇒ equal hash every 600 ticks and at 10 000 ticks (seed 42)                                                                                  |
| `game/simulation/round.test.ts`                         | rematch rebuilds the world with `seed + ROUND_SEED_INCREMENT` and fresh streams (G2)                                                                                                                       |
| `game/replay/replay-runner.integration.test.ts`         | recording a run then replaying it reproduces `finalHash`; a reseed starts a new recording                                                                                                                  |
| `testing/scenarios/echo.gameplay.test.ts` (#75)         | the scenario runner on the echo module: two runs of one seed and scripted inputs hash equal at every checkpoint and the replay reproduces them; an unseeded script is reported at the first differing tick |
| `game/world/spatial-hash.test.ts`                       | query results equal brute force and are id-sorted, on seeded populations                                                                                                                                   |
| `client … cosmetic` (`cells/radial-profile.spec.ts`)    | same seed + same tick ⇒ same membrane profile `r(θ)` (`rendering/files-and-tests.md §9`)                                                                                                                   |
| lint (`./validate.sh lint`, #69)                        | `Math.random` / `Date.now` / `performance.now` / timers banned in every package source file; allowed call sites and exemptions in `CODE-STANDARDS.md §8`                                                   |

The determinism integration test runs against the **echo** module to prove the harness (the
echo module has no `WorldState`, so there the harness hashes the bytes of
`JSON.stringify(serializeRoomState())` with the same FNV lanes) and against the Evolution module
through the real room loop, hashing `WorldState` through `computeStateHash`. A hash mismatch is always a bug in the simulation,
never a flaky test: bisect by hashing every tick and diffing the first divergent tick.

## 8. Known traps

- `Array.prototype.sort` without a comparator sorts by string; with a partial comparator ties
  fall back to insertion order, which differs between a live run and a replay after removals.
- `Object.keys` order on numeric-like keys differs from insertion order; walk closed enums by
  their declared array, never by the record's keys.
- `Set` iteration is insertion-ordered, but deletion then re-insertion changes the order.
- A `Map` in the state is fine for lookups; **never** serialise or hash it by iteration order
  unless insertion order is itself part of the contract.
- Lodash-style helpers or `structuredClone` on class instances silently drop determinism
  guarantees; keep state plain.
- A stream resumed from a stale `RandomState` (forgetting to write it back after a step) replays
  the same draws twice; the resume-and-write-back is done once in `step.ts`, never in a system.
- Prediction re-runs **whole ticks with one input per tick** (`architecture/client.md §5`); feeding the
  kernel a frame delta or more than one input per tick breaks reconciliation.
- Reading a tunable from `constants/` inside a system instead of `context.balance` makes
  `debug_set_balance` and a replayed `balance` silently disagree with the live run.
- The module's replay log orders a tick's events by kind (membership, debug patches, inputs), not
  by arrival: a `debug_set_balance` / `debug_grant_dna` / `debug_set_player` in the same tick
  window as a late join replays before the join even when it arrived after it, and that join's
  entry mass, medians and placement can differ. #180 stamps a sequence beside the tick.
