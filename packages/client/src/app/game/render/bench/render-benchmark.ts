// The frame-budget report and verdict (docs/RENDERING.md §7): the timer's numbers plus the draw
// calls, the visible counts and the GPU time become one `ClientPerformanceReport`, and the verdict
// names every stage over its budget. The draw-call counter wraps the GL draw entry points, in the
// bench build only.

import {
  BYTES_PER_MEBIBYTE,
  RENDER_STAGE_NAMES,
  type ClientPerformanceReport,
  type RenderStageName,
} from '@evolution/shared';
import {
  RENDER_FRAME_BUDGET_P95_MS,
  RENDER_GPU_BUDGET_MS,
  RENDER_HUD_BUDGET_MS,
  RENDER_MAX_DRAW_CALLS,
  RENDER_STAGE_BUDGET_MS,
} from '../constants';
import type { FrameTimingReport } from './render-stage-timer';

export interface RenderCounters {
  readonly drawCalls: number;
  readonly visibleCells: number;
  readonly visibleMotes: number;
  readonly gpuMs: number | null;
  readonly heapBytes: number | null;
}

export function buildPerformanceReport(timing: FrameTimingReport, counters: RenderCounters): ClientPerformanceReport {
  return {
    fps: timing.fps,
    frameTimeAvgMs: timing.frameTimeAvgMs,
    frameTimeP95Ms: timing.frameTimeP95Ms,
    frameTimePeakMs: timing.frameTimePeakMs,
    heapMb: counters.heapBytes === null ? null : counters.heapBytes / BYTES_PER_MEBIBYTE,
    renderStagesMs: timing.renderStagesMs,
    gpuMs: counters.gpuMs,
    drawCalls: counters.drawCalls,
    visibleCells: counters.visibleCells,
    visibleMotes: counters.visibleMotes,
  };
}

export interface BudgetOverrun {
  readonly name: RenderStageName | 'frame' | 'gpu' | 'hud' | 'drawCalls';
  readonly measured: number;
  readonly budget: number;
}

export interface BudgetVerdict {
  readonly isWithinBudget: boolean;
  readonly overruns: readonly BudgetOverrun[];
  /** `frameTimeP95Ms − Σ renderStagesMs`: what the HUD and the browser cost outside the timer. */
  readonly outsideStagesMs: number;
}

function stageOverruns(stages: Partial<Record<RenderStageName, number>>): {
  overruns: BudgetOverrun[];
  totalMs: number;
} {
  const overruns: BudgetOverrun[] = [];
  let totalMs = 0;
  for (const stage of RENDER_STAGE_NAMES) {
    const measured = stages[stage] ?? 0;
    totalMs += measured;
    if (measured > RENDER_STAGE_BUDGET_MS[stage]) {
      overruns.push({ name: stage, measured, budget: RENDER_STAGE_BUDGET_MS[stage] });
    }
  }
  return { overruns, totalMs };
}

function overrunIf(name: BudgetOverrun['name'], measured: number, budget: number): BudgetOverrun[] {
  return measured > budget ? [{ name, measured, budget }] : [];
}

/** Compares a report with the §7 budgets; a missing render field counts as within budget. */
export function budgetVerdict(report: ClientPerformanceReport): BudgetVerdict {
  const stages = stageOverruns(report.renderStagesMs ?? {});
  const outsideStagesMs = Math.max(0, report.frameTimeP95Ms - stages.totalMs);
  const overruns = [
    ...stages.overruns,
    ...overrunIf('frame', report.frameTimeP95Ms, RENDER_FRAME_BUDGET_P95_MS),
    ...overrunIf('gpu', report.gpuMs ?? 0, RENDER_GPU_BUDGET_MS),
    ...overrunIf('hud', outsideStagesMs, RENDER_HUD_BUDGET_MS),
    ...overrunIf('drawCalls', report.drawCalls ?? 0, RENDER_MAX_DRAW_CALLS),
  ];
  return { isWithinBudget: overruns.length === 0, overruns, outsideStagesMs };
}

/** The slice of a WebGL context the counter wraps. */
export interface DrawCallSource {
  drawElements(...args: unknown[]): void;
  drawArrays(...args: unknown[]): void;
  drawElementsInstanced(...args: unknown[]): void;
  drawArraysInstanced(...args: unknown[]): void;
}

export interface DrawCallCounter {
  /** Calls since the last `reset`. */
  count(): number;
  reset(): void;
}

const DRAW_METHODS = ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'] as const;

/** Wraps the four GL draw entry points so a frame's draw calls can be counted (RENDERING §6). */
export function createDrawCallCounter(context: DrawCallSource): DrawCallCounter {
  let calls = 0;
  for (const method of DRAW_METHODS) {
    const original = context[method];
    context[method] = function countedDraw(this: DrawCallSource, ...args: unknown[]): void {
      calls += 1;
      original.apply(this, args);
    };
  }
  return { count: () => calls, reset: () => void (calls = 0) };
}
