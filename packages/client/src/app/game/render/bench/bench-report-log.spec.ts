// @vitest-environment node
// What the bench route prints (docs/rendering/budget.md §7): the headline block a human reads, the rule that a
// quantile row is a verdict only where the window can support one, and the two sinks a finished run feeds.

import { RENDER_STAGE_NAMES, type ClientPerformanceReport } from '@evolution/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NOT_MEASURED, OVER_BUDGET, WITHIN_BUDGET } from '../../measurement-log';
import {
  RENDER_FRAME_BUDGET_P95_MS,
  RENDER_GPU_BUDGET_MS,
  RENDER_HUD_BUDGET_MS,
  RENDER_MAX_DRAW_CALLS,
  RENDER_P95_MIN_SAMPLE_FRAMES,
} from '../constants';
import {
  BENCH_REPORT_HEADING,
  GATE_FAILED,
  GATE_PASSED,
  benchReportHeading,
  benchReportHeadlines,
  publishBenchReport,
} from './bench-report-log';
import { benchGate } from './bench-gate';
import type { RenderBenchReport } from './bench-session';
import { GPU_TIMER_STATUS } from './gpu-timer';
import type { BudgetVerdict } from './render-benchmark';

const FRAME: ClientPerformanceReport = {
  fps: 60,
  frameTimeAvgMs: 6.1,
  frameTimeP95Ms: 8.4,
  frameTimePeakMs: 11,
  heapMb: 120,
  renderStagesMs: Object.fromEntries(
    RENDER_STAGE_NAMES.map((stage, index) => [stage, index / 10]),
  ) as ClientPerformanceReport['renderStagesMs'],
  gpuMs: 2.5,
  drawCalls: 9,
  visibleCells: 100,
  visibleMotes: 1400,
};

const VERDICT: BudgetVerdict = {
  isWithinBudget: true,
  isFullyJudged: true,
  overruns: [],
  unjudged: [],
  informational: [],
  timerResolutionMs: 0.005,
  stagesTotalMs: 2.1,
  residualP95Ms: 0.6,
  derivedResidualMs: 0.3,
  sampleCount: 120,
  isP95Estimable: true,
};

function reportWith(overrides: Partial<RenderBenchReport> = {}): RenderBenchReport {
  return {
    ...FRAME,
    seed: 42,
    tick: 0,
    zoom: 8,
    frames: 120,
    isTickAdvancing: false,
    heapGrowthBytesPerFrame: 2048,
    gpuStatus: GPU_TIMER_STATUS.ok,
    verdict: VERDICT,
    gate: benchGate(VERDICT, IS_ADVANCING, []),
    ...overrides,
  };
}

const IS_ADVANCING = true;

function rowStartingWith(report: RenderBenchReport, label: string): string {
  return benchReportHeadlines(report).find((row) => row.startsWith(label)) ?? '';
}

afterEach(() => vi.restoreAllMocks());

describe('benchReportHeading', () => {
  it('names the scene the numbers came from, and whether it advanced', () => {
    expect(benchReportHeading(reportWith())).toBe(
      `${BENCH_REPORT_HEADING} — seed 42, tick 0, zoom 8, parked on one tick`,
    );
    expect(benchReportHeading(reportWith({ isTickAdvancing: true }))).toContain('a tick a frame');
  });
});

describe('benchReportHeadlines', () => {
  it('leads with the gate: a judged, within-budget run that advanced is evidence', () => {
    expect(benchReportHeadlines(reportWith())[0]).toBe(`gate       ${GATE_PASSED}`);
  });

  it('fails the gate on an unjudged row nobody expected, and says what the URL may name (#264)', () => {
    const verdict: BudgetVerdict = { ...VERDICT, isFullyJudged: false, unjudged: ['gpu'] };
    const failed = reportWith({ verdict, gate: benchGate(verdict, IS_ADVANCING, []) });
    expect(rowStartingWith(failed, 'gate')).toBe(
      `gate       ${GATE_FAILED} — unjudged and not expected: gpu (&expectUnjudged= names what may be)`,
    );
    const expected = reportWith({ verdict, gate: benchGate(verdict, IS_ADVANCING, ['gpu']) });
    expect(rowStartingWith(expected, 'gate')).toBe(`gate       ${GATE_PASSED} (expected unjudged: gpu)`);
  });

  it('fails the gate on a parked or over-budget run, naming each reason', () => {
    const verdict: BudgetVerdict = {
      ...VERDICT,
      isWithinBudget: false,
      overruns: [{ name: 'frame', measured: 13, budget: 12 }],
    };
    const report = reportWith({ verdict, gate: benchGate(verdict, !IS_ADVANCING, []) });
    expect(rowStartingWith(report, 'gate')).toBe(
      `gate       ${GATE_FAILED} — over budget (see the verdict); parked on one tick (pass &advance=1)`,
    );
  });

  it('leads with a verdict that says every row was judged and none broke', () => {
    expect(rowStartingWith(reportWith(), 'verdict')).toBe(`verdict    ${WITHIN_BUDGET} on every judged row`);
  });

  it('names what broke, with the measurement and the budget it broke', () => {
    const verdict: BudgetVerdict = {
      ...VERDICT,
      isWithinBudget: false,
      overruns: [{ name: 'frame', measured: 18.4, budget: 12 }],
    };
    expect(rowStartingWith(reportWith({ verdict }), 'verdict')).toBe(`verdict    ${OVER_BUDGET} — frame 18.40 > 12`);
  });

  it('names the rows the window could not judge when nothing broke', () => {
    const verdict: BudgetVerdict = { ...VERDICT, isFullyJudged: false, unjudged: ['gpu'] };
    expect(rowStartingWith(reportWith({ verdict }), 'verdict')).toBe(
      `verdict    ${WITHIN_BUDGET} where judged — unjudged: gpu`,
    );
  });

  it('judges the frame, the GPU and the HUD residual against their budgets', () => {
    const report = reportWith();
    expect(rowStartingWith(report, 'frame p95')).toBe(
      `frame p95  8.40 ms / budget ${RENDER_FRAME_BUDGET_P95_MS} ms — ${WITHIN_BUDGET}`,
    );
    expect(rowStartingWith(report, 'gpu p95')).toBe(
      `gpu p95    2.50 ms / budget ${RENDER_GPU_BUDGET_MS} ms — ${WITHIN_BUDGET}`,
    );
    expect(rowStartingWith(report, 'hud p95')).toBe(
      `hud p95    0.60 ms / budget ${RENDER_HUD_BUDGET_MS} ms — ${WITHIN_BUDGET}`,
    );
  });

  it('quotes no p95 verdict from a window too short to estimate one, and says how short it was', () => {
    const verdict: BudgetVerdict = { ...VERDICT, isP95Estimable: false, sampleCount: 4, isFullyJudged: false };
    const frameRow = rowStartingWith(reportWith({ verdict }), 'frame p95');
    expect(frameRow).toContain(NOT_MEASURED);
    expect(frameRow).toContain(`a 4-frame window, under the ${RENDER_P95_MIN_SAMPLE_FRAMES} a p95 needs`);
    expect(frameRow).not.toContain(WITHIN_BUDGET);
    expect(rowStartingWith(reportWith({ verdict }), 'hud p95')).toContain(NOT_MEASURED);
  });

  it('gives the GPU timer’s own reason where the number is unavailable, not the window’s', () => {
    const report = reportWith({ gpuMs: null, gpuStatus: GPU_TIMER_STATUS.unsupported });
    expect(rowStartingWith(report, 'gpu p95')).toBe(`gpu p95    ${NOT_MEASURED} (${GPU_TIMER_STATUS.unsupported})`);
  });

  it('judges the draw calls as a count, and reports the stages and the window', () => {
    const report = reportWith();
    expect(rowStartingWith(report, 'draw calls')).toBe(
      `draw calls 9 / max ${RENDER_MAX_DRAW_CALLS} — ${WITHIN_BUDGET} (the worst frame)`,
    );
    const stagesRow = rowStartingWith(report, 'stages p95');
    expect(RENDER_STAGE_NAMES.filter((stage) => !stagesRow.includes(`${stage} `))).toEqual([]);
    expect(stagesRow).toContain('net 0.00');
    expect(stagesRow).toContain('submit 0.70');
    expect(rowStartingWith(report, 'window')).toBe(
      'window     120 frames, 100 cells, 1400 motes, heap 2048 bytes/frame (a range over runs, never one)',
    );
  });

  it('prints a row the clock is too coarse for with its number, marked unjudged with the clock step (#504)', () => {
    const verdict: BudgetVerdict = { ...VERDICT, isFullyJudged: false, unjudged: ['net', 'hud'], timerResolutionMs: 1 };
    const report = reportWith({ verdict });
    expect(rowStartingWith(report, 'verdict')).toBe(
      `verdict    ${WITHIN_BUDGET} where judged — unjudged: net, hud (the page's clock steps 1.00 ms)`,
    );
    expect(rowStartingWith(report, 'hud p95')).toBe("hud p95    0.60 ms — unjudged (the page's clock steps 1.00 ms)");
    expect(rowStartingWith(report, 'frame p95')).toContain(WITHIN_BUDGET);
  });

  it('marks the informational stages in the stages row (#470)', () => {
    const verdict: BudgetVerdict = { ...VERDICT, informational: ['camera'] };
    const stagesRow = rowStartingWith(reportWith({ verdict }), 'stages p95');
    expect(stagesRow).toContain('camera 0.10 (informational)');
    expect(stagesRow).not.toContain('net 0.00 (informational)');
  });

  it('refuses to print a heap growth it never measured', () => {
    expect(rowStartingWith(reportWith({ heapGrowthBytesPerFrame: null }), 'window')).toContain(`heap ${NOT_MEASURED}`);
  });
});

describe('publishBenchReport', () => {
  it('feeds both sinks: the element the smoke parses and the console a human reads', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const element = { textContent: '' } as HTMLElement;
    const report = reportWith();
    publishBenchReport(element, report);
    expect(JSON.parse(element.textContent ?? '')).toEqual(JSON.parse(JSON.stringify(report)));
    expect(log).toHaveBeenCalledWith(expect.stringContaining(`${BENCH_REPORT_HEADING} — seed 42`), report);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('frame p95  8.40 ms'), report);
  });
});
