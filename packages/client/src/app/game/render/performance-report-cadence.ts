// When a live room sends its `ClientPerformanceReport` to the server (ticket #256, docs/rendering/budget.md §7): once
// every `CLIENT_PERFORMANCE_REPORT_INTERVAL_MS` on the injected clock, counted from the session's first drawn frame,
// and only once the window holds `RENDER_P95_MIN_SAMPLE_FRAMES` frames, the bench's rule for a p95 anyone may quote.
// A page too slow to fill that window in an interval waits until it has, so the server never stores a p95 read off
// one or two frames. Asked once a frame; it reads the clock and compares, and allocates nothing.

import type { Clock } from '@evolution/shared';
import { CLIENT_PERFORMANCE_REPORT_INTERVAL_MS, RENDER_P95_MIN_SAMPLE_FRAMES } from './constants';

export class PerformanceReportCadence {
  /** When the current interval began: the first frame asked about, then each report sent; `null` before any frame. */
  private intervalStartMs: number | null = null;

  constructor(private readonly clock: Clock) {}

  /**
   * Whether this frame sends a report, given the frames the window holds; a `true` starts the next interval, so the
   * caller sends exactly when told.
   */
  isReportDue(windowSampleCount: number): boolean {
    const nowMs = this.clock.nowMilliseconds();
    if (this.intervalStartMs === null) {
      this.intervalStartMs = nowMs;
      return false;
    }
    if (nowMs - this.intervalStartMs < CLIENT_PERFORMANCE_REPORT_INTERVAL_MS) return false;
    if (windowSampleCount < RENDER_P95_MIN_SAMPLE_FRAMES) return false;
    this.intervalStartMs = nowMs;
    return true;
  }
}
