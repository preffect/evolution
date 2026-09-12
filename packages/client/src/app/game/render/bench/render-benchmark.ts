// The frame-budget report and its verdict (docs/RENDERING.md §7): the timer's numbers plus the
// draw calls, the visible counts and the GPU time become one `ClientPerformanceReport`, and the
// verdict names every budget the report breaks, the HUD share derived as §7 says.

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
    ...timing,
    heapMb: counters.heapBytes === null ? null : counters.heapBytes / BYTES_PER_MEBIBYTE,
    gpuMs: counters.gpuMs,
    drawCalls: counters.drawCalls,
    visibleCells: counters.visibleCells,
    visibleMotes: counters.visibleMotes,
  };
}

/** The rows of the §7 tables that are not stage keys. */
export const BUDGET_ROW = { frame: 'frame', gpu: 'gpu', hud: 'hud', drawCalls: 'drawCalls' } as const;
export type BudgetRowName = RenderStageName | (typeof BUDGET_ROW)[keyof typeof BUDGET_ROW];

export interface BudgetOverrun {
  readonly name: BudgetRowName;
  readonly measured: number;
  readonly budget: number;
}

export interface BudgetVerdict {
  readonly isWithinBudget: boolean;
  readonly overruns: readonly BudgetOverrun[];
  /** Σ `renderStagesMs`: the CPU time the timer saw. */
  readonly stagesTotalMs: number;
  /** `frameTimeP95Ms − Σ renderStagesMs`: the HUD and the browser, outside the timer (§7's HUD row). */
  readonly outsideStagesMs: number;
}

function overrunIf(name: BudgetRowName, measured: number, budget: number): BudgetOverrun[] {
  return measured > budget ? [{ name, measured, budget }] : [];
}

/** Compares a report with the §7 budgets; an unsupported GPU timer (`null`) is within budget. */
export function budgetVerdict(report: ClientPerformanceReport): BudgetVerdict {
  const stagesTotalMs = RENDER_STAGE_NAMES.reduce((sum, stage) => sum + report.renderStagesMs[stage], 0);
  const outsideStagesMs = Math.max(0, report.frameTimeP95Ms - stagesTotalMs);
  const overruns = [
    ...RENDER_STAGE_NAMES.flatMap((stage) =>
      overrunIf(stage, report.renderStagesMs[stage], RENDER_STAGE_BUDGET_MS[stage]),
    ),
    ...overrunIf(BUDGET_ROW.frame, report.frameTimeP95Ms, RENDER_FRAME_BUDGET_P95_MS),
    ...overrunIf(BUDGET_ROW.gpu, report.gpuMs ?? 0, RENDER_GPU_BUDGET_MS),
    ...overrunIf(BUDGET_ROW.hud, outsideStagesMs, RENDER_HUD_BUDGET_MS),
    ...overrunIf(BUDGET_ROW.drawCalls, report.drawCalls, RENDER_MAX_DRAW_CALLS),
  ];
  return { isWithinBudget: overruns.length === 0, overruns, stagesTotalMs, outsideStagesMs };
}
