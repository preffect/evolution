# Evolution — Deterministic Simulation Contract

Same seed + same config + same inputs ⇒ the same state, on every run, on every machine that
runs the same Node version. This is what makes gameplay scenarios (#75, #102), replays,
visual-regression screenshots and the 10 000-tick hash test (#73) possible. Structure is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md); coding rules in [`CODE-STANDARDS.md`](./CODE-STANDARDS.md).

## 1. The contract

1. **No wall clock in the simulation.** `Date.now`, `performance.now`, `setTimeout`,
   `setInterval` are lint-banned outside `packages/shared/src/time/` and
   `packages/server/src/lobby/ticker.ts`. The simulation sees only `tick` and the constant
   `TICK_DURATION_SECONDS`.
2. **No `Math.random`.** Lint-banned outside `packages/shared/src/random/`. Every random
   decision draws from a named, seeded stream (section 3).
3. **Fixed timestep.** One `stepSimulation` call advances exactly one tick. Never scale a
   system by a measured frame delta.
4. **Stable iteration order.** Entities live in arrays in insertion order; maps keyed by id are
   `Map`s iterated in insertion order; never iterate object keys for game state; every sort has
   a total comparator with an id tie-break.
5. **Inputs apply at tick boundaries.** `submitInput` only enqueues; the queue is drained at
   the start of the next step in a fixed order (section 4).
6. **State is plain data.** `SimulationState` is JSON-serialisable (no class instances, no
   functions, no `Set`/`Map` inside entities, no `undefined` holes). The random streams are
   included as their serialisable internal state.
7. **Hashable.** `computeStateHash(state)` is cheap (< 1 ms at target population) and is what
   tests and replays compare.
8. **Cosmetics are deterministic too.** Client wobble/particles use a seeded `cosmetic` stream
   derived from the session seed, so a paused game screenshots identically.

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
  /** Returns how many ticks are due since the last call, capped at maxTicksPerAdvance. */
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

In tests: `new ManualClock()` + `new ManualTicker()`; advance the clock by
`TICK_INTERVAL_MS * n` and fire the ticker once → exactly `n` steps.

## 3. Seeded random streams (`packages/shared/src/random/`, #73)

```ts
export interface RandomSource {
  nextFloat(): number; // [0, 1)
  nextInt(minInclusive: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[]; // returns a new array
  fork(label: string): RandomSource; // independent child stream
  getState(): RandomState; // serialisable, for snapshots/replays
}
export const createSeededRandom: (seed: number) => RandomSource; // xoshiro128**
export const RANDOM_STREAM = {
  spawner: 'spawner',
  npc: 'npc',
  traitDraft: 'traitDraft',
  physicsJitter: 'physicsJitter',
  respawn: 'respawn',
  cosmetic: 'cosmetic',
} as const;
```

- **Root seed** is `GameSessionConfig.seed`. The lobby fills it from its own `SystemClock`-seeded
  stream when the create request omits it, and it is shown in the HUD and by
  `debug_get_game_state`.
- **`fork(label)`** seeds the child from `hashLabel(parentSeed, label)` (FNV-1a over the label
  bytes mixed with the parent seed), **not** from the parent's sequence, so adding a draw to
  the spawner never changes what `traitDraft` produces. Forks of the same label from the same
  parent are identical. Per-entity streams are `fork(RANDOM_STREAM.cosmetic + ':' + cellId)`.
- The simulation creates its streams once in `createSimulationState` and stores them in the
  state. `debug_set_seed` rebuilds them; nothing else re-seeds.
- Never pass a `RandomSource` into a pure formula. Formulas take numbers; the calling system
  draws the numbers (`spawnPosition(random.nextFloat(), random.nextFloat(), zone)`).

## 4. Ordering rules

- **Players** are stepped in join order (`state.players` array). Late joiners append.
- **Inputs** drain per player, then by `sequence`; an input with a sequence ≤ the last applied
  one is dropped. One-shot actions apply once per sequence.
- **Entities** are stepped in array order. Removal must preserve order (filter into a new
  array or `splice`); never swap-remove. Spawns append.
- **Spatial hash** results are sorted by entity id before use. Pair processing (eating,
  absorption) iterates the sorted pair list `(lowerId, higherId)`.
- **Sorting** always uses a comparator ending in `compareEntityIds(a.id, b.id)`.
- **Floating point.** Fixed evaluation order inside systems; sums over collections go
  left-to-right in array order; no `Math.fround` tricks; NaN/Infinity are bugs (the hash
  throws on them). Node's V8 gives identical results for identical operation order; the
  contract is per Node major version (`engines` in `package.json`).

## 5. State hash (`packages/shared/src/simulation/state-hash.ts`)

```ts
export const computeStateHash: (state: HashableSimulationState) => StateHash; // 16-hex-char string
```

- Two independent 32-bit FNV-1a lanes over a **canonical walk** of the state: `tick`, then each
  array in order, each entity's fields in declared order; numbers are hashed by their IEEE-754
  bits (via a shared `DataView`), strings by UTF-16 code units, booleans as 0/1, `null` as a
  marker byte. Field order is fixed by `HASHED_FIELDS` per entity kind, so adding a debug-only
  field cannot silently change the hash.
- Random stream state is included (a run that consumed a different number of draws differs).
- Derived data (spatial hash, caches, client-only fields) is excluded.
- Cost: O(entities); computed only on demand (tests, `debug_get_state_hash`, replay end,
  `getRoomGameState` summary), never every tick in production.

## 6. Replay (`packages/server/src/game/replay/`)

```ts
export interface Replay {
  version: number; // REPLAY_FORMAT_VERSION
  seed: number;
  config: GameSessionConfig;
  balance: BalanceConfig; // the numbers the run used, so hot-reloaded balance still replays
  membership: readonly ReplayMembershipEvent[]; // { tick, kind: 'join' | 'leave', playerId, playerName, avatarIndex }
  inputs: readonly ReplayInput[]; // { tick, playerId, input }
  debugPatches: readonly ReplayDebugPatch[]; // debug_spawn / debug_set_player, stamped by tick
  finalTick: Tick;
  finalHash: StateHash;
}
export const replay: (recording: Replay) => { state: SimulationState; hash: StateHash };
```

- `ReplayRecorder` sits inside the module: joins, leaves, inputs and debug patches are stamped
  with the tick at which they are **applied** (the next step), so the log is exactly what the
  simulation saw.
- `replay()` builds a fresh state from `seed + config + balance`, feeds the log tick by tick,
  and returns the final state and hash; callers assert `hash === recording.finalHash`.
- Failing gameplay scenarios write their replay to `qa/replays/<scenario>.replay.json`;
  `debug_export_replay` exports a live room.

## 7. What the tests assert

| Test (file)                                                  | Asserts                                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `random/seeded-random.test.ts`                               | same seed ⇒ same sequence; forks independent; same label ⇒ same fork                                                      |
| `time/fixed-step-accumulator.test.ts`                        | due ticks for exact, partial and stalled advances; cap applied                                                            |
| `simulation/state-hash.test.ts`                              | equal states hash equal; any field change or reorder changes the hash; NaN throws                                         |
| `game/evolution-game-module.determinism.integration.test.ts` | two rooms, same seed, same scripted inputs under `ManualClock` ⇒ equal hash every 600 ticks and at 10 000 ticks (seed 42) |
| `game/replay/replay-runner.integration.test.ts`              | recording a run then replaying it reproduces `finalHash`                                                                  |
| `game/simulation/spatial-hash.test.ts`                       | query results equal brute force and are id-sorted, on seeded populations                                                  |
| `client … cosmetic` (`membrane-mesh.spec.ts`)                | same seed + same tick ⇒ same vertex ring                                                                                  |
| lint (`./validate.sh lint`)                                  | `Math.random` / `Date.now` / `performance.now` / timers banned outside the allowed files                                  |

The determinism integration test runs first against the **echo** module (proves the harness),
then against `EvolutionGameModule` when #98 lands. A hash mismatch is always a bug in the
simulation, never a flaky test: bisect by hashing every tick and diffing the first divergent
tick's state.

## 8. Known traps

- `Array.prototype.sort` without a comparator sorts by string; with a partial comparator ties
  fall back to insertion order, which differs between a live run and a replay after removals.
- `Object.keys` order on numeric-like keys differs from insertion order.
- `Set` iteration is insertion-ordered, but deletion then re-insertion changes the order.
- A `Map` in the state is fine for lookups; **never** serialise or hash it by iteration order
  unless insertion order is itself part of the contract.
- Lodash-style helpers or `structuredClone` on class instances silently drop determinism
  guarantees; keep state plain.
- Accumulating `deltaSeconds` from wall time on the client for the **prediction** kernel breaks
  reconciliation: prediction re-runs whole ticks, not fractional frames.
