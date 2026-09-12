// The frame-budget report and its verdict (docs/RENDERING.md §7): the timer's numbers plus the
// draw calls, the visible counts and the GPU time become one `ClientPerformanceReport`, and the
// verdict names every budget the report breaks.
//
// A verdict only judges what the window can support. A p95 needs at least
// `RENDER_P95_MIN_SAMPLE_FRAMES` samples — below that the estimator degenerates to the maximum — so a
// shorter window leaves every quantile row `unjudged` instead of comparing a maximum with a p95 budget.
// A `gpuMs` of `null` is an unavailable measurement, never an overrun. The HUD row is the residual the
// timer measured frame by frame (`frame − Σ its top-level brackets`), not the difference of two p95s, so
// it can fail; the §7 subtraction is still reported, signed, as `derivedResidualMs` — it goes negative
// when a sum of p95s exceeds the p95 of the sum, or when out-of-frame work was accrued into a stage.

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
  RENDER_P95_MIN_SAMPLE_FRAMES,
  RENDER_STAGE_BUDGET_MS,
} from '../constants';
import type { GpuTimerStatus } from './gpu-timer';
import type { FrameResidual, FrameTimingReport } from './render-stage-timer';

/** What the verdict needs beyond the wire report: how long the window is and what it left unbracketed. */
export interface FrameEvidence {
  /** Frames the window covers. */
  readonly sampleCount: number;
  readonly residual: FrameResidual;
  readonly gpuStatus: GpuTimerStatus;
}

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
  /** No row the window could judge broke its budget. */
  readonly isWithinBudget: boolean;
  /** Every row had the evidence to be judged: a long enough window and an available `gpuMs`. */
  readonly isFullyJudged: boolean;
  readonly overruns: readonly BudgetOverrun[];
  /** Rows the window cannot judge, and why the number beside them is not a verdict. */
  readonly unjudged: readonly BudgetRowName[];
  /** Σ `renderStagesMs`: the CPU time the timer saw, the sum of seven independent p95s. */
  readonly stagesTotalMs: number;
  /** The measured per-frame `frame − Σ top-level brackets`, p95: §7's HUD row. */
  readonly residualP95Ms: number;
  /** `frameTimeP95Ms − Σ renderStagesMs`, signed: reported, never judged (see the module comment). */
  readonly derivedResidualMs: number;
  /** Frames the window covers, and whether that is enough for a p95 at all. */
  readonly sampleCount: number;
  readonly isP95Estimable: boolean;
}

function overrunIf(name: BudgetRowName, measured: number, budget: number): BudgetOverrun[] {
  return measured > budget ? [{ name, measured, budget }] : [];
}

/** Every row whose number is a p95 (the whole verdict bar the draw-call count). */
function quantileRows(): BudgetRowName[] {
  return [...RENDER_STAGE_NAMES, BUDGET_ROW.frame, BUDGET_ROW.gpu, BUDGET_ROW.hud];
}

/** Compares a report with the §7 budgets; see the module comment for what a short window or a `null` `gpuMs` does. */
export function budgetVerdict(report: ClientPerformanceReport, evidence: FrameEvidence): BudgetVerdict {
  const stagesTotalMs = RENDER_STAGE_NAMES.reduce((sum, stage) => sum + report.renderStagesMs[stage], 0);
  const isP95Estimable = evidence.sampleCount >= RENDER_P95_MIN_SAMPLE_FRAMES;
  const residualP95Ms = evidence.residual.p95Ms;
  const isGpuAvailable = report.gpuMs !== null;
  const unjudged = [
    ...(isP95Estimable ? [] : quantileRows()),
    ...(isGpuAvailable || !isP95Estimable ? [] : [BUDGET_ROW.gpu]),
  ];
  const quantileOverruns = isP95Estimable
    ? [
        ...RENDER_STAGE_NAMES.flatMap((stage) =>
          overrunIf(stage, report.renderStagesMs[stage], RENDER_STAGE_BUDGET_MS[stage]),
        ),
        ...overrunIf(BUDGET_ROW.frame, report.frameTimeP95Ms, RENDER_FRAME_BUDGET_P95_MS),
        ...(report.gpuMs === null ? [] : overrunIf(BUDGET_ROW.gpu, report.gpuMs, RENDER_GPU_BUDGET_MS)),
        ...overrunIf(BUDGET_ROW.hud, residualP95Ms, RENDER_HUD_BUDGET_MS),
      ]
    : [];
  const overruns = [...quantileOverruns, ...overrunIf(BUDGET_ROW.drawCalls, report.drawCalls, RENDER_MAX_DRAW_CALLS)];
  return {
    isWithinBudget: overruns.length === 0,
    isFullyJudged: unjudged.length === 0,
    overruns,
    unjudged,
    stagesTotalMs,
    residualP95Ms,
    derivedResidualMs: report.frameTimeP95Ms - stagesTotalMs,
    sampleCount: evidence.sampleCount,
    isP95Estimable,
  };
}
