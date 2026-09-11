# Evolution — Deterministic Simulation Contract

Same seed + same config + same balance + same inputs ⇒ the same state, on every run, on every
machine that runs the same Node version. This is what makes the design's acceptance scenarios
(#75, #102), replays, visual-regression screenshots and the 10 000-tick hash test (#73)
possible. Structure is in [`ARCHITECTURE.md`](./ARCHITECTURE.md); coding rules in
[`CODE-STANDARDS.md`](./CODE-STANDARDS.md); the gameplay rules that draw from the streams are
in [`GAME-DESIGN.md`](./GAME-DESIGN.md) and [`ECOLOGY.md`](./ECOLOGY.md).

## 1. The contract

1. **No wall clock in game code.** `Date.now`, `performance.now`, `setTimeout`, `setInterval`
   and `requestAnimationFrame` are lint-banned in every `packages/*/src` file; the allowed call
   sites are `packages/shared/src/time/` (`SystemClock`) and `packages/server/src/lobby/ticker.ts`
   (`IntervalTicker`). Template infrastructure files carry an explicit, ticketed exemption
   (`CODE-STANDARDS.md §8`). The simulation sees only `world.tick` and the constant
   `TICK_INTERVAL_S`.
2. **No `Math.random`.** Lint-banned in the same files outside `packages/shared/src/random/`.
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
  /** How many ticks are due since the last call, capped at maxTicksPerAdvance; the surplus is dropped. */
  dueTicks(): number;
  /** Resync to the clock and forget the backlog; the room calls it on start() and resume(). */
  discardElapsed(): void;
  /** Ticks dropped by the cap since the last call (resets); PerfTracker reports them. */
  takeDroppedTicks(): number;
}
/** The production accumulator: TICK_INTERVAL_MS per tick, MAX_TICKS_PER_ADVANCE cap. */
export const createSimulationStepAccumulator: (clock: Clock) => FixedStepAccumulator;

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
after a stall; dropped ticks are reported through `PerformanceTracker`, never silently. Timing
measurements (`tickMs`) also come from the injected clock so `PerformanceTracker` is testable.

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
  nextGaussian(): number; // standard normal (Box–Muller, two draws)
  pick<T>(items: readonly T[]): T;
  weightedIndex(weights: readonly number[]): number; // ECOLOGY kind/zone/variant tables, draft weights
  shuffle<T>(items: readonly T[]): T[]; // returns a new array
  fork(label: string): RandomSource; // independent child stream
  getState(): RandomState; // serialisable: { seed, position, words } for xoshiro128**
}
export interface RandomState {
  readonly seed: number; // what fork() derives children from
  readonly position: number; // draws consumed since seeding (diagnostics; hashed)
  readonly words: readonly [number, number, number, number]; // the xoshiro128** state: O(1) resume
}
export const createSeededRandom: (seed: number) => RandomSource;
export const createSeededRandomFromState: (state: RandomState) => RandomSource; // exact resume
export const RANDOM_STREAM = {
  spawner: 'spawner', // food and fragment spawns: kind, zone, variant, point (ECOLOGY §3)
  zones: 'zones', // gel patch placement at world creation (ECOLOGY §2)
  spawnPlacement: 'spawn_placement', // safe spawn candidates (GAME-DESIGN §5.2)
  traitDraft: 'trait_draft', // draft sampling (PROGRESSION §3)
  moteMotion: 'mote_motion', // bacteria random-walk headings; fragment drift direction at spawn
  wildCells: 'wild_cells', // wild cells: spread factors, wander headings, turn rolls (ECOLOGY §3.3)
  engulf: 'engulf', // spit-out rolls: one draw per tick per wrapped or sealed prey with spitOutChancePerSecond > 0 (ECOLOGY §6.1)
  cosmetic: 'cosmetic', // client only, never on the server
} as const;
export type RandomStreamLabel = (typeof RANDOM_STREAM)[keyof typeof RANDOM_STREAM];
export type ServerRandomStreamLabel = Exclude<RandomStreamLabel, 'cosmetic'>;
/** The server streams in declared order: the order createWorld forks them and the hash walk of world.random. */
export const SERVER_RANDOM_STREAM_LABELS: readonly ServerRandomStreamLabel[];
/** Every label: the server streams, then `cosmetic` (client only). */
export const RANDOM_STREAM_LABELS: readonly RandomStreamLabel[];
/** Forks one child per label from root, keyed by label; what createWorld stores in world.random. */
export const forkStreamStates: <Label extends string>(
  root: RandomSource,
  labels: readonly Label[],
) => Record<Label, RandomState>;
```

- **Algorithm.** xoshiro128** (Blackman & Vigna), 128-bit state, all 32-bit integer
  arithmetic so every engine agrees; a 32-bit seed is expanded into the four state words with
  splitmix32 (`random/xoshiro128-star-star.ts`, known-answer tested against the reference
  sequence from state {1, 2, 3, 4}). `nextFloat` is the 32-bit output over 2^32. The state
  carries the four words, not only `{ seed, position }`: resuming from a position alone would
  replay every earlier draw, and `step.ts` resumes each stream every tick. `nextGaussian`
  (Box–Muller) and any heading maths downstream use `Math.log` / `Math.sqrt` / `Math.cos`,
  whose bit-exactness across engines is a libm property, not a language guarantee; that is
  inside the contract (§1: same Node version, server-authoritative), so a divergence between
  engines there is not a PRNG bug and the integer core must not be "fixed" for it.
- `createSeededRandomFromState` rejects a corrupt state as loudly as a corrupt seed: `words`
  must be exactly four unsigned 32-bit integers and not all zero (the one state xoshiro cannot
  leave), `position` a non-negative safe integer. Replays, saves and `debug_set_seed` all
  arrive from JSON.
- Seeds are non-negative integers reduced modulo 2^32 (`SEED_MAX` is the config-boundary
  bound; the rematch increment past it wraps). A negative, fractional or non-finite seed throws.

- **Root seed** is `GameSessionConfig.seed`, generated by the creating client
  (`crypto.getRandomValues`, not simulation code) and validated against `SEED_MAX`. The server
  never invents a seed. It is shown in the lobby row, the HUD and `debug_get_game_state`.
- **`fork(label)`** seeds the child from `hashLabel(parentSeed, label)` (FNV-1a over the label
  bytes mixed with the parent seed), **not** from the parent's sequence, so adding a draw to
  the spawner never changes what `traitDraft` produces. Forks of the same label from the same
  parent are identical.
- **`moteMotion` is a separate stream** (ECOLOGY §1 lists it under the label `mote_motion`): the
  bacteria random walk draws every tick for every living bacterium, and tying it to `spawner`
  would make every spawn position depend on how many bacteria are alive.
- **Who creates the streams.** `createWorld(seed, config, playerIds)` forks the server
  streams from the round seed (`forkStreamStates(createSeededRandom(seed), SERVER_RANDOM_STREAM_LABELS)`)
  and stores their state in `world.random`; systems obtain a live
  source per step through `context.streams[label]`, which resumes from the stored state and
  writes it back after the step. Exactly two things re-create the streams: the **auto-rematch**
  (`session/round.ts` rebuilds the world from `seed + ROUND_SEED_INCREMENT`, GAME-DESIGN §5.4;
  G2 asserts seed 43) and **`debug_set_seed`**. The module factory receives no `RandomSource`.
- Never pass a `RandomSource` into a pure formula. Formulas take numbers; the calling system
  draws them (`spawnPointInZone(zone, random.nextFloat(), random.nextFloat())`).

## 4. Ordering rules

- **Players** are stepped in join order (`world.players`). Late joiners append.
- **Inputs:** one coalesced input per player per tick; a `sequence` ≤ the applied one is
  dropped. One-shots (`shouldSprint`, `traitChoice`) apply once.
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

## 5. State hash (`packages/shared/src/simulation/state-hash.ts`, `packages/server/src/game/world/state-hash.ts`)

```ts
export const computeStateHash: (world: HashableWorldState) => StateHash; // 16-hex-char string
```

The kernel is split in two: `simulation/state-hasher.ts` (`StateHasher`: the two lanes, the
scalar encodings, `digest()`) and `simulation/state-hash.ts` (the walk helpers `hashFields`,
`hashEnumRecord`, `hashArray`, `hashRandomStreams`, `hashText`); `computeStateHash` itself composes
them over the server records' `HASHED_FIELDS` lists in `packages/server/src/game/world/state-hash.ts`,
beside the records it walks. Both lanes fold bytes with the one FNV-1a primitive in
`hashing/fnv1a.ts`, which `hashLabel` shares. A `HashedField<T>` entry is a scalar field name
or `{ key, hash }` for a nested value, so listing a field with the wrong shape is a type error.

- Two independent 32-bit FNV-1a lanes over a **canonical walk**: `tick`, `seed`, `roundStartTick`,
  `roundPhase`, `roundTimeLeftMs`, `roundFirstEntityNumber`, then each array in order (`cells`,
  `food`, `dnaFragments`, `players`, `wildSeats`, `gelPatches`), the two `spawners`, the `random`
  streams in `SERVER_RANDOM_STREAM_LABELS` order, then `nextEntityNumber`; each record's fields in
  the order `HASHED_FIELDS[kind]` declares. Every scalar is preceded by a type tag
  (so `0`, `false`, `""` and `null` differ); numbers hash by their IEEE-754 bits (one shared
  `DataView`), strings by a length prefix then UTF-16 code units, booleans as 0/1, `null` as a
  marker byte; arrays and enum records by a length prefix then their items.
- **No object-key iteration.** `Record<DnaTag, number>` and `Record<BacteriumVariant, number>`
  are walked in `DNA_TAGS` / `BACTERIUM_VARIANTS` order; `world.random` in
  `SERVER_RANDOM_STREAM_LABELS` order (the client's `cosmetic` stream is never in the hashed
  world). A record field that is not in `HASHED_FIELDS` is not hashed, so adding a debug-only
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
  simulation saw (not what arrived).
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
  applied tick, hash checkpoints), which `verifyReplay` replays through the adapter (`TESTING.md`
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
| `client … cosmetic` (`cells/radial-profile.spec.ts`)    | same seed + same tick ⇒ same membrane profile `r(θ)` (`RENDERING.md §9`)                                                                                                                                   |
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
- Prediction re-runs **whole ticks with one input per tick** (`ARCHITECTURE.md §5`); feeding the
  kernel a frame delta or more than one input per tick breaks reconciliation.
- Reading a tunable from `constants/` inside a system instead of `context.balance` makes
  `debug_set_balance` and a replayed `balance` silently disagree with the live run.
- The module's replay log orders a tick's events by kind (membership, debug patches, inputs), not
  by arrival: a `debug_set_balance` / `debug_grant_dna` / `debug_set_player` in the same tick
  window as a late join replays before the join even when it arrived after it, and that join's
  entry mass, medians and placement can differ. #180 stamps a sequence beside the tick.
