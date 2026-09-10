import { describe, expect, it } from 'vitest';
import { ManualClock, SystemClock } from './clock.js';

const START_MS = 1000;
const DELTA_MS = 250;

describe('ManualClock', () => {
  it('starts at zero by default and at the given start otherwise', () => {
    expect(new ManualClock().nowMilliseconds()).toBe(0);
    expect(new ManualClock(START_MS).nowMilliseconds()).toBe(START_MS);
  });

  it('moves only when advanced or set', () => {
    const clock = new ManualClock(START_MS);
    expect(clock.nowMilliseconds()).toBe(START_MS);
    clock.advanceMilliseconds(DELTA_MS);
    expect(clock.nowMilliseconds()).toBe(START_MS + DELTA_MS);
    clock.setMilliseconds(0);
    expect(clock.nowMilliseconds()).toBe(0);
  });
});

describe('SystemClock', () => {
  it('reads a monotonic, non-decreasing number', () => {
    const clock = new SystemClock();
    const first = clock.nowMilliseconds();
    const second = clock.nowMilliseconds();
    expect(Number.isFinite(first)).toBe(true);
    expect(second).toBeGreaterThanOrEqual(first);
  });
});
