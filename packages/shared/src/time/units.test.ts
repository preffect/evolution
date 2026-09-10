import { describe, expect, it } from 'vitest';
import { TICK_HZ, TICK_INTERVAL_MS } from '../constants/network.js';
import { millisecondsToTicks, secondsToTicks, ticksToMilliseconds, ticksToSeconds } from './units.js';

const HALF_SECOND = 0.5;
const THREE_TICKS = 3;
const JUST_UNDER_HALF_A_TICK_S = 0.4 / TICK_HZ;

describe('time units', () => {
  it('converts whole seconds to TICK_HZ ticks', () => {
    expect(secondsToTicks(1)).toBe(TICK_HZ);
    expect(secondsToTicks(HALF_SECOND)).toBe(TICK_HZ / 2);
  });

  it('rounds to the nearest tick', () => {
    expect(secondsToTicks(JUST_UNDER_HALF_A_TICK_S)).toBe(0);
    expect(secondsToTicks(1 / TICK_HZ + JUST_UNDER_HALF_A_TICK_S)).toBe(1);
  });

  it('converts milliseconds through the same tick interval', () => {
    expect(millisecondsToTicks(TICK_INTERVAL_MS * THREE_TICKS)).toBe(THREE_TICKS);
  });

  it('round-trips ticks to seconds and milliseconds', () => {
    expect(secondsToTicks(ticksToSeconds(THREE_TICKS))).toBe(THREE_TICKS);
    expect(millisecondsToTicks(ticksToMilliseconds(THREE_TICKS))).toBe(THREE_TICKS);
    expect(ticksToSeconds(TICK_HZ)).toBeCloseTo(1);
  });
});
