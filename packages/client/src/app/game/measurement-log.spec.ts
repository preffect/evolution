// @vitest-environment node
// The dev routes' console sink (docs/rendering/budget.md §7): the formatters that decide what a human reads, and
// the two calls that put a report on the console. What the browser actually prints is verified on the routes
// themselves — this pins the text and the fact that both sinks are called.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NOT_MEASURED,
  OVER_BUDGET,
  WITHIN_BUDGET,
  formatAgainstBudget,
  formatAgainstCount,
  formatMeasuredMilliseconds,
  formatMeasuredNumber,
  formatShare,
  logMeasurementFailure,
  logMeasurementReport,
  measurementRow,
} from './measurement-log';

afterEach(() => vi.restoreAllMocks());

describe('formatMeasuredNumber', () => {
  it('quotes a measurement to two decimals', () => {
    expect(formatMeasuredNumber(18.4)).toBe('18.40');
    expect(formatMeasuredMilliseconds(18.4)).toBe('18.40 ms');
  });

  it('never invents a zero for a number that was not taken', () => {
    expect(formatMeasuredNumber(null)).toBe(NOT_MEASURED);
    expect(formatMeasuredNumber(Number.NaN)).toBe(NOT_MEASURED);
    expect(formatMeasuredMilliseconds(Number.POSITIVE_INFINITY)).toBe(NOT_MEASURED);
  });
});

describe('formatAgainstBudget', () => {
  it('judges a measurement against its budget, the boundary counting as within it', () => {
    expect(formatAgainstBudget(4.21, 12, 'no window')).toBe(`4.21 ms / budget 12 ms — ${WITHIN_BUDGET}`);
    expect(formatAgainstBudget(12, 12, 'no window')).toBe(`12.00 ms / budget 12 ms — ${WITHIN_BUDGET}`);
    expect(formatAgainstBudget(12.01, 12, 'no window')).toBe(`12.01 ms / budget 12 ms — ${OVER_BUDGET}`);
  });

  it('prints the reason instead of a verdict where nothing could be measured', () => {
    expect(formatAgainstBudget(null, 12, 'a 4-frame window')).toBe(`${NOT_MEASURED} (a 4-frame window)`);
    expect(formatAgainstBudget(null, 12, 'a 4-frame window')).not.toContain(WITHIN_BUDGET);
  });
});

describe('formatAgainstCount', () => {
  it('judges a count against its ceiling', () => {
    expect(formatAgainstCount(17, 20)).toBe(`17 / max 20 — ${WITHIN_BUDGET}`);
    expect(formatAgainstCount(21, 20)).toBe(`21 / max 20 — ${OVER_BUDGET}`);
  });
});

describe('formatShare', () => {
  it('reads a span against the whole it sits inside', () => {
    expect(formatShare(150.2, 210.5)).toBe('71%');
  });

  it('refuses a whole there is nothing to divide by', () => {
    expect(formatShare(150.2, 0)).toBe(NOT_MEASURED);
    expect(formatShare(150.2, Number.NaN)).toBe(NOT_MEASURED);
  });
});

describe('measurementRow', () => {
  it('pads the label so the numbers line up under each other', () => {
    expect(measurementRow('gpu p95', 'x')).toBe('gpu p95    x');
    expect(measurementRow('draw calls', 'x')).toBe('draw calls x');
  });
});

describe('logMeasurementReport', () => {
  it('prints the headline block indented under its heading, and the report object beside it', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const report = { frameTimeP95Ms: 4.2 };
    logMeasurementReport('Render bench — seed 42', ['verdict    within budget', 'frame p95  4.20 ms'], report);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      'Render bench — seed 42\n  verdict    within budget\n  frame p95  4.20 ms',
      report,
    );
  });
});

describe('logMeasurementFailure', () => {
  it('names what could not be done on the error channel', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logMeasurementFailure('Encyclopedia preview evidence', 'no frame drawn');
    expect(error).toHaveBeenCalledWith('Encyclopedia preview evidence: no report — no frame drawn');
  });
});
