import { describe, expect, it, vi } from 'vitest';
import { RENDER_STAGE, RENDER_STAGE_NAMES, type RenderStageName } from '@evolution/shared';
import { RENDER_MAX_DRAW_CALLS, RENDER_STAGE_BUDGET_MS } from '../constants';
import { budgetVerdict, buildPerformanceReport, createDrawCallCounter, type DrawCallSource } from './render-benchmark';

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
    expect(report).toMatchObject({
      fps: 60,
      frameTimeP95Ms: 1,
      heapMb: 3,
      drawCalls: 12,
      visibleMotes: 1400,
      gpuMs: 2,
    });
    expect(
      buildPerformanceReport(timing, { drawCalls: 0, visibleCells: 0, visibleMotes: 0, gpuMs: null, heapBytes: null })
        .heapMb,
    ).toBeNull();
  });
});

describe('budgetVerdict', () => {
  const within = buildPerformanceReport(timing, {
    drawCalls: 10,
    visibleCells: 1,
    visibleMotes: 1,
    gpuMs: 1,
    heapBytes: null,
  });

  it('passes a report inside every budget and reports the time outside the stages', () => {
    const verdict = budgetVerdict(within);
    expect(verdict.isWithinBudget).toBe(true);
    expect(verdict.outsideStagesMs).toBeCloseTo(1 - 7 * 0.05, 9);
  });

  it('names every overrun: a stage, the frame, the GPU, the HUD share and the draw calls', () => {
    const verdict = budgetVerdict({
      ...within,
      renderStagesMs: { ...stages(0.1), [RENDER_STAGE.cells]: RENDER_STAGE_BUDGET_MS.cells + 1 },
      frameTimeP95Ms: 20,
      gpuMs: 9,
      drawCalls: RENDER_MAX_DRAW_CALLS + 1,
    });
    expect(verdict.isWithinBudget).toBe(false);
    expect(verdict.overruns.map((overrun) => overrun.name)).toEqual(['cells', 'frame', 'gpu', 'hud', 'drawCalls']);
  });

  it('treats a report without render fields as within the stage budgets', () => {
    const verdict = budgetVerdict({ fps: 60, frameTimeAvgMs: 1, frameTimeP95Ms: 1, frameTimePeakMs: 1, heapMb: null });
    expect(verdict.isWithinBudget).toBe(true);
  });
});

describe('createDrawCallCounter', () => {
  it('counts every wrapped draw call, still forwarding it, and resets', () => {
    const context: DrawCallSource = {
      drawElements: vi.fn(),
      drawArrays: vi.fn(),
      drawElementsInstanced: vi.fn(),
      drawArraysInstanced: vi.fn(),
    };
    const forwarded = context.drawElementsInstanced;
    const counter = createDrawCallCounter(context);
    context.drawElementsInstanced(1, 2, 3, 4, 5);
    context.drawArrays(0, 0, 3);
    expect(counter.count()).toBe(2);
    expect(forwarded).toHaveBeenCalledWith(1, 2, 3, 4, 5);
    counter.reset();
    expect(counter.count()).toBe(0);
  });
});
