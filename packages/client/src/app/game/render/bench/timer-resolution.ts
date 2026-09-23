// The resolution of the clock the stage timer reads (docs/rendering/budget.md §7, ticket #504). Browsers quantise
// `performance.now()` — 1 ms in Firefox, 0.1 ms plus jitter in Chrome — unless the page is cross-origin isolated, and
// a stage p95 read off such a clock is a count of ticks. The verdict leaves a row unjudged when its budget is under
// ten ticks.

import type { Clock } from '@evolution/shared';
import { RENDER_TIMER_PROBE_MAX_READINGS, RENDER_TIMER_PROBE_STEPS } from '../constants';

/**
 * The smallest positive step between consecutive readings, over `RENDER_TIMER_PROBE_STEPS` steps; `null` when the
 * clock did not move in `RENDER_TIMER_PROBE_MAX_READINGS` readings (a test clock), so nothing is known about it.
 */
export function probeTimerResolutionMs(clock: Clock): number | null {
  let smallestStepMs = Number.POSITIVE_INFINITY;
  let steps = 0;
  let previousMs = clock.nowMilliseconds();
  for (let reading = 0; reading < RENDER_TIMER_PROBE_MAX_READINGS && steps < RENDER_TIMER_PROBE_STEPS; reading += 1) {
    const nowMs = clock.nowMilliseconds();
    if (nowMs > previousMs) {
      smallestStepMs = Math.min(smallestStepMs, nowMs - previousMs);
      steps += 1;
    }
    previousMs = nowMs;
  }
  return steps === 0 ? null : smallestStepMs;
}
