import { describe, expect, it } from 'vitest';
import {
  RENDER_STAGE,
  RENDER_STAGE_NAMES,
  createTestClientPerformanceReport,
  type RenderStageName,
} from '@evolution/shared';
import { RENDER_MAX_DRAW_CALLS, RENDER_STAGE_BUDGET_MS } from '../constants';
import { BUDGET_ROW, budgetVerdict, buildPerformanceReport } from './render-benchmark';

function stages(fill: number): Record<RenderStageName, number> {
  return Object.fromEntries(RENDER_STAGE_NAMES.map((stage) => [stage, fill])) as Record<RenderStageName, number>;
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
    const verdict = budgetVerdict(createTestClientPerformanceReport({ ...timing }));
    expect(verdict.isWithinBudget).toBe(true);
    expect(verdict.stagesTotalMs).toBeCloseTo(7 * 0.05, 9);
    expect(verdict.outsideStagesMs).toBeCloseTo(1 - 7 * 0.05, 9);
  });

  it('names every overrun: a stage, the frame, the GPU, the HUD share and the draw calls', () => {
    const verdict = budgetVerdict(
      createTestClientPerformanceReport({
        renderStagesMs: { ...stages(0.1), [RENDER_STAGE.cells]: RENDER_STAGE_BUDGET_MS.cells + 1 },
        frameTimeP95Ms: 20,
        gpuMs: 9,
        drawCalls: RENDER_MAX_DRAW_CALLS + 1,
      }),
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

  it('treats an unsupported GPU timer as within budget and clamps the outside share at zero', () => {
    const verdict = budgetVerdict(createTestClientPerformanceReport({ gpuMs: null, frameTimeP95Ms: 0 }));
    expect(verdict.isWithinBudget).toBe(true);
    expect(verdict.outsideStagesMs).toBe(0);
  });
});
