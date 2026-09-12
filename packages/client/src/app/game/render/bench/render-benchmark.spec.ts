import {
  RENDER_STAGE,
  RENDER_STAGE_NAMES,
  createTestClientPerformanceReport,
  type RenderStageName,
} from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import {
  RENDER_HUD_BUDGET_MS,
  RENDER_MAX_DRAW_CALLS,
  RENDER_P95_MIN_SAMPLE_FRAMES,
  RENDER_STAGE_BUDGET_MS,
} from '../constants';
import { GPU_TIMER_STATUS } from './gpu-timer';
import { BUDGET_ROW, budgetVerdict, buildPerformanceReport, type FrameEvidence } from './render-benchmark';

function stages(fill: number): Record<RenderStageName, number> {
  return Object.fromEntries(RENDER_STAGE_NAMES.map((stage) => [stage, fill])) as Record<RenderStageName, number>;
}

/** A window long enough to judge, with the residual the test cares about. */
function evidence(residualP95Ms: number, overrides: Partial<FrameEvidence> = {}): FrameEvidence {
  return {
    sampleCount: RENDER_P95_MIN_SAMPLE_FRAMES,
    residual: { p95Ms: residualP95Ms, peakMs: residualP95Ms, minimumMs: 0 },
    gpuStatus: GPU_TIMER_STATUS.ok,
    ...overrides,
  };
}

const timing = { fps: 60, frameTimeAvgMs: 5, frameTimeP95Ms: 1, frameTimePeakMs: 9, renderStagesMs: stages(0.05) };

describe('buildPerformanceReport', () => {
  it('assembles the wire report with the heap in MiB and the counters', () => {
    const report = buildPerformanceReport(timing, {
      drawCalls: 12,
      visibleCells: 8,
      visibleMotes: 1400,
      gpuMs: 2,
      heapBytes: 3 * 1024 * 1024,
    });
    expect(report).toEqual({ ...timing, heapMb: 3, drawCalls: 12, visibleCells: 8, visibleMotes: 1400, gpuMs: 2 });
    const unmeasured = { drawCalls: 0, visibleCells: 0, visibleMotes: 0, gpuMs: null, heapBytes: null };
    expect(buildPerformanceReport(timing, unmeasured).heapMb).toBeNull();
  });
});

describe('budgetVerdict', () => {
  it('passes a report inside every budget and reports the time inside and outside the stages', () => {
    const verdict = budgetVerdict(createTestClientPerformanceReport({ ...timing, gpuMs: 1 }), evidence(0.4));
    expect(verdict.isWithinBudget).toBe(true);
    expect(verdict.isFullyJudged).toBe(true);
    expect(verdict.stagesTotalMs).toBeCloseTo(7 * 0.05, 9);
    expect(verdict.residualP95Ms).toBe(0.4);
    expect(verdict.derivedResidualMs).toBeCloseTo(1 - 7 * 0.05, 9);
  });

  it('names every overrun: a stage, the frame, the GPU, the HUD share and the draw calls', () => {
    const verdict = budgetVerdict(
      createTestClientPerformanceReport({
        renderStagesMs: { ...stages(0.1), [RENDER_STAGE.cells]: RENDER_STAGE_BUDGET_MS.cells + 1 },
        frameTimeP95Ms: 20,
        gpuMs: 9,
        drawCalls: RENDER_MAX_DRAW_CALLS + 1,
      }),
      evidence(RENDER_HUD_BUDGET_MS + 1),
    );
    expect(verdict.isWithinBudget).toBe(false);
    expect(verdict.overruns.map((overrun) => overrun.name)).toEqual([
      RENDER_STAGE.cells,
      BUDGET_ROW.frame,
      BUDGET_ROW.gpu,
      BUDGET_ROW.hud,
      BUDGET_ROW.drawCalls,
    ]);
    expect(verdict.overruns[0]).toEqual({
      name: RENDER_STAGE.cells,
      measured: RENDER_STAGE_BUDGET_MS.cells + 1,
      budget: RENDER_STAGE_BUDGET_MS.cells,
    });
  });

  it('fails the HUD row on a measured residual, which the old derived one could not', () => {
    // The stages sum past the frame p95 (seven p95s are not the p95 of their sum), so the derived residual is
    // negative while the frame really did spend 2 ms outside every bracket.
    const verdict = budgetVerdict(
      createTestClientPerformanceReport({ renderStagesMs: stages(1), frameTimeP95Ms: 5 }),
      evidence(2),
    );
    expect(verdict.derivedResidualMs).toBe(5 - 7);
    expect(verdict.overruns.map((overrun) => overrun.name)).toContain(BUDGET_ROW.hud);
  });

  it('leaves an unavailable GPU time unjudged instead of calling it an overrun', () => {
    const verdict = budgetVerdict(createTestClientPerformanceReport({ gpuMs: null }), evidence(0));
    expect(verdict.overruns.map((overrun) => overrun.name)).not.toContain(BUDGET_ROW.gpu);
    expect(verdict.unjudged).toEqual([BUDGET_ROW.gpu]);
    expect(verdict.isWithinBudget).toBe(true);
    expect(verdict.isFullyJudged).toBe(false);
  });

  it('judges no quantile row in a window too short to estimate a p95, but still judges the draw calls', () => {
    const report = createTestClientPerformanceReport({
      renderStagesMs: stages(9),
      frameTimeP95Ms: 99,
      gpuMs: 99,
      drawCalls: RENDER_MAX_DRAW_CALLS + 1,
    });
    const short = evidence(99, { sampleCount: RENDER_P95_MIN_SAMPLE_FRAMES - 1 });
    const verdict = budgetVerdict(report, short);
    expect(verdict.isP95Estimable).toBe(false);
    expect(verdict.sampleCount).toBe(RENDER_P95_MIN_SAMPLE_FRAMES - 1);
    expect(verdict.overruns.map((overrun) => overrun.name)).toEqual([BUDGET_ROW.drawCalls]);
    expect(verdict.unjudged).toEqual([...RENDER_STAGE_NAMES, BUDGET_ROW.frame, BUDGET_ROW.gpu, BUDGET_ROW.hud]);
    expect(budgetVerdict(report, evidence(99)).isP95Estimable, 'one more frame is enough to judge').toBe(true);
  });
});
