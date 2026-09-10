# Evolution — Deterministic Simulation Contract

Same seed + same config + same balance + same inputs ⇒ the same state, on every run, on every
machine that runs the same Node version. This is what makes the design's acceptance scenarios
(#75, #102), replays, visual-regression screenshots and the 10 000-tick hash test (#73)
possible. Structure is in [`ARCHITECTURE.md`](./ARCHITECTURE.md); coding rules in
[`CODE-STANDARDS.md`](./CODE-STANDARDS.md); the gameplay rules that draw from the streams are
in [`GAME-DESIGN.md`](./GAME-DESIGN.md) and [`ECOLOGY.md`](./ECOLOGY.md).

## 1. The contract

1. **No wall clock in game code.** `Date.now`, `performance.now`, `setTimeout`, `setInterval`
   are lint-banned in the game paths (`packages/shared/src/**` except `time/`,
   `packages/server/src/game/**`, `packages/client/src/app/game/**`). Template infrastructure
   files carry an explicit, ticketed exemption (`CODE-STANDARDS.md §8`). The simulation sees only
   `world.tick` and the constant `TICK_INTERVAL_S`.
2. **No `Math.random`.** Lint-banned in the same paths outside `packages/shared/src/random/`.
   Every random decision draws from a named, seeded stream (section 3).
3. **Fixed timestep.** One `stepWorld` call advances exactly one tick. Never scale a system by
   a measured frame delta.
4. **Stable iteration order.** Entities live in arrays in insertion order; never iterate object
   keys for game state (records keyed by a closed enum are walked in the enum's declared array
   order, section 5); every sort has a total comparator with an id tie-break.
5. **Inputs apply at tick boundaries.** `submitInput` only coalesces into the player's pending
   slot; step 1 applies it in join order (`ARCHITECTURE.md §3.2`).
6. **State is plain data.** `WorldState` is JSON-serialisable (no class instances, functions,
   `Set`/`Map` inside entities, or `undefined` holes). The random streams are stored as their
   serialisable state (`RandomState`) and rebuilt from it.
7. **Hashable.** `computeStateHash(world)` is cheap (< 1 ms at target population) and is what
   tests and replays compare.
8. **Cosmetics are deterministic too.** Client wobble and particles use a `cosmetic` stream
   forked from the round seed, so a paused game screenshots identically.
9. **The step order is a contract.** The ten steps of `ARCHITECTURE.md §3` are the order every
   scenario table in the design assumes (`ECOLOGY.md §8`); changing it means recomputing them.

## 2. Clock and fixed step (`packages/shared/src/time/`, `packages/server/src/lobby/ticker.ts`)

```ts
/** Monotonic milliseconds. The only way to read time. */
export interface Clock {
  nowMilliseconds(): number;
}
export class SystemClock implements Clock {} // performance.now(); the one allowed call site
export class ManualClock implements Clock {
  advanceMilliseconds(delta: number): void;
  setMilliseconds(now: number): void;
}

/** Turns wall time into whole ticks; owns the accumulator, never the state. */
export class FixedStepAccumulator {
  constructor(clock: Clock, tickDurationMilliseconds: number, maxTicksPerAdvance: number);
  /** How many ticks are due since the last call, capped at maxTicksPerAdvance. */
  dueTicks(): number;
}

/** Drives GameRoom.tickStep(); real interval in prod, hand-cranked in tests. */
export interface Ticker {
  start(onTick: () => void): void;
  stop(): void;
}
export class IntervalTicker implements Ticker {} // setInterval(TICK_INTERVAL_MS); prod only
export class ManualTicker implements Ticker {
  fire(times?: number): void;
}
```

`GameRoom` takes `{ clock, ticker }` in its constructor (the `LobbyManager` receives them from
`index.ts`). On each ticker fire it calls `accumulator.dueTicks()` and steps that many times,
serialising every `SNAPSHOT_EVERY_TICKS` (3) ticks. `MAX_TICKS_PER_ADVANCE` (5) caps catch-up
after a stall; dropped ticks are reported through `PerfTracker`, never silently. Timing
measurements (`tickMs`) also come from the injected clock so `PerfTracker` is testable.

`TICK_INTERVAL_MS` is fractional (16.67 ms) and timer APIs round to whole milliseconds, so
`setInterval` alone would not hold 60 Hz; the cadence is correct because the accumulator counts
due ticks from the clock, and the interval only wakes it. In tests: `new ManualClock()` +
`new ManualTicker()`; advance the clock by `TICK_INTERVAL_MS × n` and fire the ticker once →
exactly `n` steps.

## 3. Seeded random streams (`packages/shared/src/random/`, #73)

```ts
export interface RandomSource {
  nextFloat(): number; // [0, 1)
  nextInt(minInclusive: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  weightedIndex(weights: readonly number[]): number; // ECOLOGY kind/zone/variant tables, draft weights
  shuffle<T>(items: readonly T[]): T[]; // returns a new array
  fork(label: string): RandomSource; // independent child stream
  getState(): RandomState; // serialisable: { seed, position } for xoshiro128**
}
export const createSeededRandom: (seed: number) => RandomSource;
export const createSeededRandomFromState: (state: RandomState) => RandomSource; // exact resume
export const RANDOM_STREAM = {
  spawner: 'spawner', // food and fragment spawns: kind, zone, variant, point (ECOLOGY §3)
  zones: 'zones', // gel patch placement at world creation (ECOLOGY §2)
  spawnPlacement: 'spawn_placement', // safe spawn candidates (GAME-DESIGN §5.2)
  traitDraft: 'trait_draft', // draft sampling (PROGRESSION §3)
  moteMotion: 'mote_motion', // bacteria random-walk headings; fragment drift direction at spawn
  cosmetic: 'cosmetic', // client only, never on the server
} as const;
export type RandomStreamLabel = (typeof RANDOM_STREAM)[keyof typeof RANDOM_STREAM];
```

- **Root seed** is `GameSessionConfig.seed`, generated by the creating client
  (`crypto.getRandomValues`, not simulation code) and validated against `SEED_MAX`. The server
  never invents a seed. It is shown in the lobby row, the HUD and `debug_get_game_state`.
- **`fork(label)`** seeds the child from `hashLabel(parentSeed, label)` (FNV-1a over the label
  bytes mixed with the parent seed), **not** from the parent's sequence, so adding a draw to
  the spawner never changes what `traitDraft` produces. Forks of the same label from the same
  parent are identical.
- **`moteMotion` is a separate stream** (an architecture refinement of ECOLOGY's list): the
  bacteria random walk draws every tick for every living bacterium, and tying it to `spawner`
  would make every spawn position depend on how many bacteria are alive.
- **Who creates the streams.** `createWorld(seed, config, playerIds)` forks the five server
  streams from the round seed and stores their state in `world.random`; systems obtain a live
  source per step through `context.streams[label]`, which resumes from the stored state and
  writes it back after the step. Exactly two things re-create the streams: the **auto-rematch**
  (`session/round.ts` rebuilds the world from `seed + ROUND_SEED_INCREMENT`, GAME-DESIGN §5.4;
  G2 asserts seed 43) and **`debug_set_seed`**. The module factory receives no `RandomSource`.
- Never pass a `RandomSource` into a pure formula. Formulas take numbers; the calling system
  draws them (`spawnPointInZone(zone, random.nextFloat(), random.nextFloat())`).

## 4. Ordering rules

- **Players** are stepped in join order (`world.players`). Late joiners append.
- **Inputs:** one coalesced input per player per tick; a `sequence` ≤ the applied one is
  dropped. One-shots (`sprint`, `traitChoice`) apply once.
- **Entities** are stepped in array order. Removal preserves order (`filter` into a new array
  or `splice`); never swap-remove. Spawns append. Cluster members spawn in draw order.
- **Spatial hash** results are id-sorted before use. Pair processing (separation, engulf)
  iterates the sorted pair list `(lowerId, higherId)`; "two predators reach one prey" resolves to
  the lower cell id (ECOLOGY §6.3).
- **Sorting** always ends in `compareEntityIds(a.id, b.id)`; the leaderboard comparator is
  score, then mass, then `joinOrder`.
- **Floating point.** Fixed evaluation order inside systems; sums over collections go
  left-to-right in array order; no `Math.fround` tricks; NaN/Infinity are bugs (the hash throws
  on them). Identical operation order gives identical results on one Node major version
  (`engines` in `package.json`).

## 5. State hash (`packages/shared/src/simulation/state-hash.ts`)

```ts
export const computeStateHash: (world: HashableWorldState) => StateHash; // 16-hex-char string
```

- Two independent 32-bit FNV-1a lanes over a **canonical walk**: `tick`, `seed`,
  `roundPhase`, `roundTimeLeftMs`, then each array in order (`cells`, `food`, `dnaFragments`,
  `players`, `gelPatches`, `spawners`, `random` streams in `RANDOM_STREAM` order), each record's
  fields in the order `HASHED_FIELDS[kind]` declares. Numbers hash by their IEEE-754 bits (one
  shared `DataView`), strings by UTF-16 code units, booleans as 0/1, `null` as a marker byte.
- **No object-key iteration.** `Record<DnaTag, number>` and `Record<BacteriumVariant, number>`
  are walked in `DNA_TAGS` / `BACTERIUM_VARIANTS` order; `world.random` in `RANDOM_STREAM`
  order. A record field that is not in `HASHED_FIELDS` is not hashed, so adding a debug-only
  field cannot silently change the hash, and a new gameplay field must be added to the list
  (the test table pins that every non-derived field is listed).
- Random stream state is included (a run that consumed a different number of draws differs).
- Derived data (spatial hash, `leaderboard`, `effects`, `balance`, `config`) is excluded:
  the leaderboard is a function of the players, effects are transient, and balance and config
  are inputs recorded by the replay instead.
- Cost: O(entities); computed on demand (tests, `debug_get_state_hash`, replay end, the
  `getRoomGameState` summary), never every tick in production.

## 6. Replay (`packages/server/src/game/replay/`)

```ts
export interface Replay {
  version: number; // REPLAY_FORMAT_VERSION
  seed: number; // the round seed the recording started from
  config: GameSessionConfig;
  balance: BalanceConfig; // the numbers the run used, so a live-tuned room still replays
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
  simulation saw (not what arrived).
- **One replay = one round.** The auto-rematch and `debug_set_seed` end the current recording
  (its `finalTick`/`finalHash` are the last tick before the reset) and start a new one from the
  new seed; a replay never spans a reseed.
- `replay()` builds a fresh world from `seed + config + balance`, feeds the log tick by tick,
  and returns the final world and hash; callers assert `hash === recording.finalHash`.
- Failing gameplay scenarios write their replay to `qa/replays/<scenario>.replay.json`;
  `debug_export_replay` exports a live room.

## 7. What the tests assert

| Test (file)                                             | Asserts                                                                                                                                 |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `random/seeded-random.test.ts`                          | same seed ⇒ same sequence; forks independent; same label ⇒ same fork; `createSeededRandomFromState(getState())` continues identically   |
| `time/fixed-step-accumulator.test.ts`                   | due ticks for exact, partial and stalled advances; cap applied                                                                          |
| `simulation/state-hash.test.ts`                         | equal worlds hash equal; any hashed field change or reorder changes the hash; NaN throws; every non-derived field is in `HASHED_FIELDS` |
| `game/evolution-module.determinism.integration.test.ts` | two rooms, same seed, same scripted inputs under `ManualClock` ⇒ equal hash every 600 ticks and at 10 000 ticks (seed 42)               |
| `game/simulation/round.test.ts`                         | rematch rebuilds the world with `seed + ROUND_SEED_INCREMENT` and fresh streams (G2)                                                    |
| `game/replay/replay-runner.integration.test.ts`         | recording a run then replaying it reproduces `finalHash`; a reseed starts a new recording                                               |
| `game/world/spatial-hash.test.ts`                       | query results equal brute force and are id-sorted, on seeded populations                                                                |
| `client … cosmetic` (`membrane-mesh.spec.ts`)           | same seed + same tick ⇒ same vertex ring                                                                                                |
| lint (`./validate.sh lint`, #69)                        | `Math.random` / `Date.now` / `performance.now` / timers banned in the game paths; exemptions listed in `CODE-STANDARDS.md §8`           |

The determinism integration test runs first against the **echo** module to prove the harness:
the echo module has no `WorldState`, so there the harness hashes the bytes of
`JSON.stringify(serializeRoomState())` with the same FNV lanes; once #98 lands it hashes
`WorldState` through `computeStateHash`. A hash mismatch is always a bug in the simulation,
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
- Prediction re-runs **whole ticks with one input per tick** (`ARCHITECTURE.md §5`); feeding the
  kernel a frame delta or more than one input per tick breaks reconciliation.
- Reading a tunable from `constants/` inside a system instead of `context.balance` makes
  `debug_set_balance` and a replayed `balance` silently disagree with the live run.
