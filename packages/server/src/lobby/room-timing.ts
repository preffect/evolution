// The time sources a GameRoom is born with (docs/DETERMINISM.md §2): the clock the accumulator
// and the perf timings read, and the ticker that wakes the loop. Rooms never touch wall time.

import { SystemClock, type Clock } from '@evolution/shared';
import { IntervalTicker, type Ticker } from './ticker.js';

export interface RoomTiming {
  readonly clock: Clock;
  readonly ticker: Ticker;
}

/** Builds one timing pair per room: a ticker holds a live interval, so it is never shared. */
export type RoomTimingFactory = () => RoomTiming;

/** Production timing: the monotonic system clock and a real interval ticker. */
export const createSystemRoomTiming: RoomTimingFactory = () => ({
  clock: new SystemClock(),
  ticker: new IntervalTicker(),
});
