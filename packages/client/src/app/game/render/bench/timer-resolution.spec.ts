// @vitest-environment node
import type { Clock } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { RENDER_TIMER_PROBE_MAX_READINGS, RENDER_TIMER_RESOLUTION_BUDGET_FRACTION } from '../constants';
import { isClockFineEnoughFor, probeTimerResolutionMs } from './timer-resolution';

/** A clock that repeats each value `readingsPerStep` times, then steps through `stepsMs` in turn. */
function steppingClock(stepsMs: readonly number[], readingsPerStep: number): Clock & { readings: number } {
  let nowMs = 0;
  let readingsAtValue = 0;
  let stepIndex = 0;
  return {
    readings: 0,
    nowMilliseconds() {
      this.readings += 1;
      readingsAtValue += 1;
      if (readingsAtValue > readingsPerStep) {
        nowMs += stepsMs[stepIndex % stepsMs.length]!;
        stepIndex += 1;
        readingsAtValue = 0;
      }
      return nowMs;
    },
  };
}

describe('probeTimerResolutionMs', () => {
  it('reads a whole-millisecond clock as 1 ms', () => {
    expect(probeTimerResolutionMs(steppingClock([1], 50))).toBe(1);
  });

  it('takes the smallest step of a jittered clock', () => {
    expect(probeTimerResolutionMs(steppingClock([0.13, 0.1, 0.17], 3))).toBeCloseTo(0.1, 9);
  });

  it('returns null for a clock that never moves, after a bounded number of readings', () => {
    const frozen = steppingClock([1], Number.POSITIVE_INFINITY);
    expect(probeTimerResolutionMs(frozen)).toBeNull();
    expect(frozen.readings).toBeLessThanOrEqual(RENDER_TIMER_PROBE_MAX_READINGS + 1);
  });
});

describe('isClockFineEnoughFor', () => {
  it('passes a clock whose step is at most a tenth of the budget, fails a coarser one, and passes an unknown one', () => {
    const budgetMs = 1;
    expect(isClockFineEnoughFor(budgetMs, budgetMs * RENDER_TIMER_RESOLUTION_BUDGET_FRACTION)).toBe(true);
    expect(isClockFineEnoughFor(budgetMs, budgetMs * RENDER_TIMER_RESOLUTION_BUDGET_FRACTION * 1.01)).toBe(false);
    expect(isClockFineEnoughFor(budgetMs, null)).toBe(true);
  });
});
