// @vitest-environment node
// What the preview evidence route prints (docs/rendering/budget.md §7.1): the headline block a human reads, and
// the two sinks a finished run feeds — the element the smoke parses and the console.

import { RENDER_STAGE_NAMES, type ClientPerformanceReport } from '@evolution/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NOT_MEASURED, OVER_BUDGET, WITHIN_BUDGET } from '../measurement-log';
import {
  PREVIEW_REPORT_HEADING,
  previewReportHeading,
  previewReportHeadlines,
  publishPreviewFailure,
  publishPreviewReport,
} from './preview-report-log';
import type { PreviewRouteReport } from './preview-route';

const FRAME: ClientPerformanceReport = {
  fps: 60,
  frameTimeAvgMs: 0.7,
  frameTimeP95Ms: 0.85,
  frameTimePeakMs: 1.2,
  heapMb: null,
  renderStagesMs: Object.fromEntries(
    RENDER_STAGE_NAMES.map((stage) => [stage, 0]),
  ) as ClientPerformanceReport['renderStagesMs'],
  gpuMs: null,
  drawCalls: 4,
  visibleCells: 1,
  visibleMotes: 0,
};

const COLD_OPEN = { initMs: 40.1, bakeMs: 150.2, firstSubmitMs: 12, openedToFirstFrameMs: 210.5 };

function reportWith(overrides: Partial<PreviewRouteReport> = {}): PreviewRouteReport {
  return {
    anchor: 'trait:flagellum',
    scene: 'cell',
    parkAtSeconds: 1,
    walkFrames: 30,
    opens: 3,
    coldOpen: COLD_OPEN,
    warmOpens: [
      { ...COLD_OPEN, openedToFirstFrameMs: 120 },
      { ...COLD_OPEN, openedToFirstFrameMs: 130 },
    ],
    openP95Ms: 129.5,
    frame: FRAME,
    budgets: { openMs: 300, frameMs: 1 },
    verdict: { isOpenWithinBudget: true, isFrameWithinBudget: true },
    ...overrides,
  };
}

function fakeElement(): HTMLElement {
  return { textContent: '' } as HTMLElement;
}

afterEach(() => vi.restoreAllMocks());

describe('previewReportHeading', () => {
  it('names the scene, the anchor that chose it and the park', () => {
    expect(previewReportHeading(reportWith())).toBe(
      `${PREVIEW_REPORT_HEADING} — cell (trait:flagellum), parked at 1 s, 3 opens`,
    );
  });

  it('drops the anchor where `?preview` carried none, and counts one open in the singular', () => {
    expect(previewReportHeading(reportWith({ anchor: null, opens: 1 }))).toBe(
      `${PREVIEW_REPORT_HEADING} — cell, parked at 1 s, 1 open`,
    );
  });
});

describe('previewReportHeadlines', () => {
  it('leads with the open p95 against its budget', () => {
    const [openRow] = previewReportHeadlines(reportWith());
    expect(openRow).toBe(`open p95   129.50 ms / budget 300 ms — ${WITHIN_BUDGET}`);
  });

  it('says OVER BUDGET when the p95 is past it', () => {
    const [openRow] = previewReportHeadlines(reportWith({ openP95Ms: 412.4 }));
    expect(openRow).toBe(`open p95   412.40 ms / budget 300 ms — ${OVER_BUDGET}`);
  });

  it('explains an unmeasured p95 by the opens the page ran, and says what would produce one', () => {
    const [openRow] = previewReportHeadlines(reportWith({ opens: 1, warmOpens: [], openP95Ms: null }));
    expect(openRow).toContain(NOT_MEASURED);
    expect(openRow).toContain('0 warm opens');
    expect(openRow).toContain('&opens=20');
    expect(openRow).not.toContain(WITHIN_BUDGET);
  });

  it('judges the parked frame against the frame budget', () => {
    const rows = previewReportHeadlines(reportWith());
    expect(rows[1]).toBe(`frame p95  0.85 ms / budget 1 ms — ${WITHIN_BUDGET}`);
    const overBudget = previewReportHeadlines(reportWith({ frame: { ...FRAME, frameTimeP95Ms: 1.4 } }));
    expect(overBudget[1]).toContain(OVER_BUDGET);
  });

  it('splits the cold open and gives the bake its share of it', () => {
    const rows = previewReportHeadlines(reportWith());
    expect(rows[2]).toBe('cold open  210.50 ms — init 40.10 ms, bake 150.20 ms (71% of it), first submit 12.00 ms');
  });
});

describe('publishPreviewReport', () => {
  it('feeds both sinks: the element the smoke parses and the console a human reads', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const element = fakeElement();
    const report = reportWith();
    publishPreviewReport(element, report);
    expect(JSON.parse(element.textContent ?? '')).toEqual(JSON.parse(JSON.stringify(report)));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('open p95   129.50 ms'), report);
    expect(log).toHaveBeenCalledWith(expect.stringContaining(PREVIEW_REPORT_HEADING), report);
  });
});

describe('publishPreviewFailure', () => {
  it('writes the failure to the element and says on the console what could not be done', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const element = fakeElement();
    publishPreviewFailure(element, { error: 'no frame drawn' });
    expect(element.textContent).toBe('{"error":"no frame drawn"}');
    expect(error).toHaveBeenCalledWith(`${PREVIEW_REPORT_HEADING}: no report — no frame drawn`);
  });
});
