// The page's time in the dive's bake slices (docs/rendering/opening-dive.md §6, ticket #814): every slice the upper
// bands bake on the scheduler is timed on the injected clock, so the resolution governor judges the frames drawn
// between the slices with the slices left out (a slice slows a frame whatever the resolution). Before, it judged no
// frame while a band baked, and under software GL at DPR 2 that held the canvas at full resolution through the whole
// orbit and into the fall.

import type { Clock, Scheduler } from '@evolution/shared';

export class DiveBakeTime {
  private spentMs = 0;

  constructor(private readonly clock: Clock) {}

  /** Every slice's time so far. */
  get totalMs(): number {
    return this.spentMs;
  }

  /** `scheduler`, with each call it runs timed as a bake slice. */
  timed(scheduler: Scheduler): Scheduler {
    return { after: (delayMs, callback) => scheduler.after(delayMs, () => this.measure(callback)) };
  }

  private measure(callback: () => void): void {
    const startedMs = this.clock.nowMilliseconds();
    try {
      callback();
    } finally {
      this.spentMs += this.clock.nowMilliseconds() - startedMs;
    }
  }
}
