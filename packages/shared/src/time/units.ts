// The one place time constants become ticks (docs/CODE-STANDARDS.md §2). Constants are stored
// in seconds (or milliseconds with the suffix); systems work in whole ticks.

import { TICK_HZ, TICK_INTERVAL_MS, TICK_INTERVAL_S } from '../constants/network.js';

/** Whole ticks nearest to `seconds` at `TICK_HZ`. */
export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * TICK_HZ);
}

/**
 * True when `seconds` is a whole number of ticks: the nearest tick, read back as `ticks / TICK_HZ`, is `seconds` itself
 * (600, 600.5 and `36 019 / TICK_HZ` are; 600.005 is not). A start that must land on a tick is checked with this.
 */
export function isWholeNumberOfTicks(seconds: number): boolean {
  return secondsToTicks(seconds) / TICK_HZ === seconds;
}

/** Whole ticks nearest to `milliseconds` at `TICK_HZ`. */
export function millisecondsToTicks(milliseconds: number): number {
  return Math.round(milliseconds / TICK_INTERVAL_MS);
}

/** Seconds spanned by `ticks`. */
export function ticksToSeconds(ticks: number): number {
  return ticks * TICK_INTERVAL_S;
}

/** Milliseconds spanned by `ticks`. */
export function ticksToMilliseconds(ticks: number): number {
  return ticks * TICK_INTERVAL_MS;
}
