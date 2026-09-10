// Turns wall time into whole simulation ticks (docs/DETERMINISM.md §2). Owns the accumulator,
// never the state: the room steps the world `dueTicks()` times per ticker fire.

import { TICK_INTERVAL_MS } from '../constants/network.js';
import { FIXED_STEP_ROUNDING_TOLERANCE_TICKS, MAX_TICKS_PER_ADVANCE } from '../constants/simulation.js';
import type { Clock } from './clock.js';

export class FixedStepAccumulator {
  private lastMilliseconds: number;
  private owedMilliseconds = 0;
  private droppedTicks = 0;

  constructor(
    private readonly clock: Clock,
    private readonly tickDurationMilliseconds: number,
    private readonly maxTicksPerAdvance: number,
  ) {
    this.lastMilliseconds = clock.nowMilliseconds();
  }

  /**
   * How many ticks are due since the last call, capped at `maxTicksPerAdvance`. Ticks beyond
   * the cap are dropped (the backlog is discarded, not deferred) and counted for
   * `takeDroppedTicks()`; the fractional remainder of a capped interval is discarded too, so
   * the next call starts from a clean tick boundary rather than carrying a partial tick.
   */
  dueTicks(): number {
    const now = this.clock.nowMilliseconds();
    // A monotonic clock never goes backwards; a rewound ManualClock simply owes nothing.
    const elapsed = Math.max(0, now - this.lastMilliseconds);
    this.lastMilliseconds = now;
    this.owedMilliseconds += elapsed;

    const owedTicks = Math.floor(
      this.owedMilliseconds / this.tickDurationMilliseconds + FIXED_STEP_ROUNDING_TOLERANCE_TICKS,
    );
    this.owedMilliseconds -= owedTicks * this.tickDurationMilliseconds;
    if (owedTicks <= this.maxTicksPerAdvance) {
      return owedTicks;
    }
    this.droppedTicks += owedTicks - this.maxTicksPerAdvance;
    this.owedMilliseconds = 0;
    return this.maxTicksPerAdvance;
  }

  /**
   * Resyncs to the clock and forgets the backlog: whatever time passed since the last call owes
   * nothing and counts as nothing dropped. A room calls this when it starts or resumes so the
   * loop never bursts to catch up on time it was not meant to simulate.
   */
  discardElapsed(): void {
    this.lastMilliseconds = this.clock.nowMilliseconds();
    this.owedMilliseconds = 0;
    this.droppedTicks = 0;
  }

  /** Ticks dropped by the cap since the last call; resets the count (reported by `PerfTracker`). */
  takeDroppedTicks(): number {
    const dropped = this.droppedTicks;
    this.droppedTicks = 0;
    return dropped;
  }
}

/** The production accumulator: `TICK_INTERVAL_MS` per tick, `MAX_TICKS_PER_ADVANCE` cap. */
export function createSimulationStepAccumulator(clock: Clock): FixedStepAccumulator {
  return new FixedStepAccumulator(clock, TICK_INTERVAL_MS, MAX_TICKS_PER_ADVANCE);
}
