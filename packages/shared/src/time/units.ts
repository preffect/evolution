// The one place time constants become ticks (docs/CODE-STANDARDS.md §2). Constants are stored
// in seconds (or milliseconds with the suffix); systems work in whole ticks.

import { TICK_HZ, TICK_INTERVAL_MS, TICK_INTERVAL_S } from '../constants/network.js';

/** Whole ticks nearest to `seconds` at `TICK_HZ`. */
export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * TICK_HZ);
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
