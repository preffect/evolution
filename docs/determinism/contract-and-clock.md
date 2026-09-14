# Evolution — Deterministic Simulation Contract: the contract, clock and fixed step

§1–§2 of the split [`DETERMINISM.md`](../DETERMINISM.md), which keeps the shared context and the file list.

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
   slot; step 1 applies it in join order (`architecture/server-simulation.md §3.2`).
6. **State is plain data.** `WorldState` is JSON-serialisable (no class instances, functions,
   `Set`/`Map` inside entities, or `undefined` holes). The random streams are stored as their
   serialisable state (`RandomState`) and rebuilt from it.
7. **Hashable.** `computeStateHash(world)` is cheap (< 1 ms at target population) and is what
   tests and replays compare.
8. **Cosmetics are deterministic too.** Client wobble and particles use a `cosmetic` stream
   forked from the round seed, so a paused game screenshots identically.
9. **The step order is a contract.** The ten steps of `architecture/server-simulation.md §3` are the order every
   scenario table in the design assumes (`ecology/acceptance.md §8`); changing it means recomputing them.

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
serialising every `SNAPSHOT_EVERY_TICKS` = 3 ticks (#214). `MAX_TICKS_PER_ADVANCE` (5) caps catch-up
after a stall; dropped ticks are reported through `PerformanceTracker`, never silently. Timing
measurements (`tickMs`) also come from the injected clock so `PerformanceTracker` is testable.

`TICK_INTERVAL_MS` is fractional (16.67 ms) and timer APIs round to whole milliseconds, so
`setInterval` alone would not hold 60 Hz; the cadence is correct because the accumulator counts
due ticks from the clock, and the interval only wakes it. In tests: `new ManualClock()` +
`new ManualTicker()`; advance the clock by `TICK_INTERVAL_MS × n` and fire the ticker once →
exactly `n` steps.
