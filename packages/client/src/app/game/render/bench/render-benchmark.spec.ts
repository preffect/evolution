// @vitest-environment node
import {
  RENDER_STAGE,
  RENDER_STAGE_NAMES,
  createTestClientPerformanceReport,
  type RenderStageName,
} from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import {
  RENDER_FRAME_BUDGET_P95_MS,
  RENDER_HUD_BUDGET_MS,
  RENDER_JUDGED_STAGE_BUDGET_MIN_MS,
  RENDER_MAX_DRAW_CALLS,
  RENDER_P95_MIN_SAMPLE_FRAMES,
  RENDER_STAGE_BUDGET_MS,
  RENDER_TIMER_RESOLUTION_BUDGET_FRACTION,
} from '../constants';
import { BUDGET_ROW, budgetVerdict, buildPerformanceReport, type FrameEvidence } from './render-benchmark';

function stages(fill: number): Record<RenderStageName, number> {
  return Object.fromEntries(RENDER_STAGE_NAMES.map((stage) => [stage, fill])) as Record<RenderStageName, number>;
}

/** A cross-origin-isolated page's clock step: fine enough for every judged row. */
const FINE_CLOCK_MS = 0.005;
/** Firefox's and many Chrome pages' `performance.now()` step (ticket #504). */
const WHOLE_MILLISECOND_CLOCK_MS = 1;

const INFORMATIONAL = RENDER_STAGE_NAMES.filter(
  (stage) => RENDER_STAGE_BUDGET_MS[stage] < RENDER_JUDGED_STAGE_BUDGET_MIN_MS,
);
const JUDGED_STAGES = RENDER_STAGE_NAMES.filter((stage) => !INFORMATIONAL.includes(stage));

/** A window long enough to judge, with the residual the test cares about. */
function evidence(residualP95Ms: number, overrides: Partial<FrameEvidence> = {}): FrameEvidence {
  return {
    sampleCount: RENDER_P95_MIN_SAMPLE_FRAMES,
    residual: { p95Ms: residualP95Ms, peakMs: residualP95Ms, minimumMs: 0 },
    timerResolutionMs: FINE_CLOCK_MS,
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
    expect(verdict.stagesTotalMs).toBeCloseTo(RENDER_STAGE_NAMES.length * 0.05, 9);
    expect(verdict.residualP95Ms).toBe(0.4);
    expect(verdict.derivedResidualMs).toBeCloseTo(1 - RENDER_STAGE_NAMES.length * 0.05, 9);
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
    // The stages sum past the frame p95 (eight p95s are not the p95 of their sum), so the derived residual is
    // negative while the frame really did spend 2 ms outside every bracket.
    const verdict = budgetVerdict(
      createTestClientPerformanceReport({ renderStagesMs: stages(1), frameTimeP95Ms: 5 }),
      evidence(2),
    );
    expect(verdict.derivedResidualMs).toBe(5 - RENDER_STAGE_NAMES.length);
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
    expect(verdict.unjudged).toEqual([...JUDGED_STAGES, BUDGET_ROW.frame, BUDGET_ROW.gpu, BUDGET_ROW.hud]);
    expect(budgetVerdict(report, evidence(99)).isP95Estimable, 'one more frame is enough to judge').toBe(true);
  });

  it('reports the sub-millisecond stages as informational: never an overrun, never unjudged (ticket #470)', () => {
    expect([...INFORMATIONAL].sort(), 'the §7 rows under 1 ms').toEqual(
      [RENDER_STAGE.food, RENDER_STAGE.effects, RENDER_STAGE.camera, RENDER_STAGE.dish].sort(),
    );
    const verdict = budgetVerdict(
      createTestClientPerformanceReport({ renderStagesMs: stages(0.9), gpuMs: 1 }),
      evidence(0.4),
    );
    expect(verdict.informational).toEqual(INFORMATIONAL);
    expect(verdict.overruns, 'food, effects, camera and dish at 0.9 ms are over their budgets, yet not judged').toEqual(
      [],
    );
    expect(verdict.unjudged).toEqual([]);
    expect(verdict.isFullyJudged).toBe(true);
  });

  it('leaves the rows a 1 ms clock cannot resolve unjudged, and still judges the frame (ticket #504)', () => {
    // Firefox's report from ticket #470: every stage an exact whole millisecond, over the 1 ms budgets.
    const verdict = budgetVerdict(
      createTestClientPerformanceReport({
        renderStagesMs: stages(2),
        frameTimeP95Ms: RENDER_FRAME_BUDGET_P95_MS + 1,
        gpuMs: 1,
      }),
      evidence(2, { timerResolutionMs: WHOLE_MILLISECOND_CLOCK_MS }),
    );
    expect(verdict.unjudged).toEqual([...JUDGED_STAGES, BUDGET_ROW.hud]);
    expect(
      verdict.overruns.map((overrun) => overrun.name),
      'the 12 ms frame resolves at 1 ms',
    ).toEqual([BUDGET_ROW.frame]);
    expect(verdict.timerResolutionMs).toBe(WHOLE_MILLISECOND_CLOCK_MS);
    expect(verdict.isFullyJudged).toBe(false);
  });

  it('judges a row once the clock resolves a tenth of its budget, and not a step coarser', () => {
    const report = createTestClientPerformanceReport({ renderStagesMs: stages(0.1), gpuMs: 1 });
    const cellsLimitMs = RENDER_STAGE_BUDGET_MS.cells * RENDER_TIMER_RESOLUTION_BUDGET_FRACTION;
    expect(budgetVerdict(report, evidence(0.4, { timerResolutionMs: cellsLimitMs })).unjudged).not.toContain(
      RENDER_STAGE.cells,
    );
    expect(budgetVerdict(report, evidence(0.4, { timerResolutionMs: cellsLimitMs * 1.01 })).unjudged).toContain(
      RENDER_STAGE.cells,
    );
  });

  it('leaves nothing unjudged for a clock whose step was never measured (a test clock)', () => {
    const verdict = budgetVerdict(
      createTestClientPerformanceReport({ gpuMs: 1 }),
      evidence(0.4, { timerResolutionMs: null }),
    );
    expect(verdict.unjudged).toEqual([]);
    expect(verdict.timerResolutionMs).toBeNull();
  });
});
