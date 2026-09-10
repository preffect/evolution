import { describe, expect, it } from 'vitest';
import { TICK_INTERVAL_MS } from '../constants/network.js';
import { MAX_TICKS_PER_ADVANCE } from '../constants/simulation.js';
import { ManualClock } from './clock.js';
import { createSimulationStepAccumulator, FixedStepAccumulator } from './fixed-step-accumulator.js';

const TICK_MS = 10;
const MAX_TICKS = 3;
const HALF_TICK_MS = TICK_MS / 2;
const STALL_TICKS = 10;
const LONG_RUN_TICKS = 600;

function createAccumulator(): { clock: ManualClock; accumulator: FixedStepAccumulator } {
  const clock = new ManualClock();
  return { clock, accumulator: new FixedStepAccumulator(clock, TICK_MS, MAX_TICKS) };
}

describe('FixedStepAccumulator', () => {
  it('owes nothing before time moves', () => {
    expect(createAccumulator().accumulator.dueTicks()).toBe(0);
  });

  it('owes exactly n ticks after n intervals', () => {
    const { clock, accumulator } = createAccumulator();
    clock.advanceMilliseconds(TICK_MS * 2);
    expect(accumulator.dueTicks()).toBe(2);
    expect(accumulator.dueTicks()).toBe(0);
  });

  it('carries a partial interval into the next call', () => {
    const { clock, accumulator } = createAccumulator();
    clock.advanceMilliseconds(HALF_TICK_MS);
    expect(accumulator.dueTicks()).toBe(0);
    clock.advanceMilliseconds(HALF_TICK_MS);
    expect(accumulator.dueTicks()).toBe(1);
    clock.advanceMilliseconds(TICK_MS + HALF_TICK_MS);
    expect(accumulator.dueTicks()).toBe(1);
    clock.advanceMilliseconds(HALF_TICK_MS);
    expect(accumulator.dueTicks()).toBe(1);
  });

  it('caps a stall at the maximum, drops the backlog and reports the dropped ticks once', () => {
    const { clock, accumulator } = createAccumulator();
    clock.advanceMilliseconds(TICK_MS * STALL_TICKS + HALF_TICK_MS);
    expect(accumulator.dueTicks()).toBe(MAX_TICKS);
    expect(accumulator.takeDroppedTicks()).toBe(STALL_TICKS - MAX_TICKS);
    expect(accumulator.takeDroppedTicks()).toBe(0);
    clock.advanceMilliseconds(HALF_TICK_MS);
    expect(accumulator.dueTicks()).toBe(0);
  });

  it('does not count ticks as dropped when the cap is exactly met', () => {
    const { clock, accumulator } = createAccumulator();
    clock.advanceMilliseconds(TICK_MS * MAX_TICKS);
    expect(accumulator.dueTicks()).toBe(MAX_TICKS);
    expect(accumulator.takeDroppedTicks()).toBe(0);
  });

  it('owes nothing when the clock is rewound', () => {
    const { clock, accumulator } = createAccumulator();
    clock.advanceMilliseconds(TICK_MS);
    clock.setMilliseconds(0);
    expect(accumulator.dueTicks()).toBe(0);
    clock.advanceMilliseconds(TICK_MS);
    expect(accumulator.dueTicks()).toBe(1);
  });
});

describe('createSimulationStepAccumulator', () => {
  it('owes one tick per TICK_INTERVAL_MS despite the fractional interval', () => {
    const clock = new ManualClock();
    const accumulator = createSimulationStepAccumulator(clock);
    for (let tick = 1; tick <= LONG_RUN_TICKS; tick += 1) {
      clock.advanceMilliseconds(TICK_INTERVAL_MS);
      expect(accumulator.dueTicks()).toBe(1);
    }
  });

  it('caps at MAX_TICKS_PER_ADVANCE', () => {
    const clock = new ManualClock();
    const accumulator = createSimulationStepAccumulator(clock);
    clock.advanceMilliseconds(TICK_INTERVAL_MS * (MAX_TICKS_PER_ADVANCE + 1));
    expect(accumulator.dueTicks()).toBe(MAX_TICKS_PER_ADVANCE);
    expect(accumulator.takeDroppedTicks()).toBe(1);
  });
});
