import { describe, expect, it } from 'vitest';
import { ManualClock } from '@evolution/shared';
import { CLIENT_PERFORMANCE_REPORT_INTERVAL_MS, RENDER_P95_MIN_SAMPLE_FRAMES } from './constants';
import { PerformanceReportCadence } from './performance-report-cadence';

/** A window that holds enough frames for a p95 (docs/rendering/budget.md §7). */
const FULL_WINDOW = RENDER_P95_MIN_SAMPLE_FRAMES;
const ONE_MS = 1;

function cadenceUnderTest() {
  const clock = new ManualClock(0);
  return { clock, cadence: new PerformanceReportCadence(clock) };
}

describe('PerformanceReportCadence (ticket #256)', () => {
  it('starts the interval on the first frame and is due once it has run, never before', () => {
    const { clock, cadence } = cadenceUnderTest();
    clock.advanceMilliseconds(CLIENT_PERFORMANCE_REPORT_INTERVAL_MS);
    // The first frame starts the interval, however late it comes: a session that has drawn nothing has nothing to say.
    expect(cadence.isReportDue(FULL_WINDOW)).toBe(false);
    clock.advanceMilliseconds(CLIENT_PERFORMANCE_REPORT_INTERVAL_MS - ONE_MS);
    expect(cadence.isReportDue(FULL_WINDOW)).toBe(false);
    clock.advanceMilliseconds(ONE_MS);
    expect(cadence.isReportDue(FULL_WINDOW)).toBe(true);
  });

  it('starts the next interval at the report it allowed, so it answers true once per interval', () => {
    const { clock, cadence } = cadenceUnderTest();
    cadence.isReportDue(FULL_WINDOW);
    clock.advanceMilliseconds(CLIENT_PERFORMANCE_REPORT_INTERVAL_MS);
    expect(cadence.isReportDue(FULL_WINDOW)).toBe(true);
    expect(cadence.isReportDue(FULL_WINDOW)).toBe(false);
    clock.advanceMilliseconds(CLIENT_PERFORMANCE_REPORT_INTERVAL_MS - ONE_MS);
    expect(cadence.isReportDue(FULL_WINDOW)).toBe(false);
    clock.advanceMilliseconds(ONE_MS);
    expect(cadence.isReportDue(FULL_WINDOW)).toBe(true);
  });

  it('holds a report until the window can carry a p95, then sends it without waiting another interval', () => {
    const { clock, cadence } = cadenceUnderTest();
    cadence.isReportDue(0);
    clock.advanceMilliseconds(CLIENT_PERFORMANCE_REPORT_INTERVAL_MS * 2);
    expect(cadence.isReportDue(FULL_WINDOW - 1)).toBe(false);
    expect(cadence.isReportDue(FULL_WINDOW)).toBe(true);
  });
});
