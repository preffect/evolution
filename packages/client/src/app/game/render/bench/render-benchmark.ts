// The frame-budget report and its verdict (docs/rendering/budget.md §7): the timer's numbers plus the
// draw calls, the visible counts and the GPU time become one `ClientPerformanceReport`, and the
// verdict names every budget the report breaks.
//
// A verdict only judges what the window can support. A p95 needs at least
// `RENDER_P95_MIN_SAMPLE_FRAMES` samples — below that the estimate comes from the window's top one or two
// samples whatever the estimator — so a shorter window leaves every quantile row `unjudged` rather than
// comparing a near-maximum with a p95 budget.
// A stage budget under `RENDER_JUDGED_STAGE_BUDGET_MIN_MS` is informational (the ruling on ticket #470): its p95 is
// reported, never judged, and never makes the verdict less than fully judged. A row read off the page's CPU clock
// (a stage, the frame, the HUD residual) is `unjudged` when the clock is too coarse for its budget: a resolution
// above `RENDER_TIMER_RESOLUTION_BUDGET_FRACTION` of it (ticket #504). The GPU row has its own timer.
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
  RENDER_JUDGED_STAGE_BUDGET_MIN_MS,
  RENDER_MAX_DRAW_CALLS,
  RENDER_P95_MIN_SAMPLE_FRAMES,
  RENDER_STAGE_BUDGET_MS,
  RENDER_TIMER_RESOLUTION_BUDGET_FRACTION,
} from '../constants';
import type { FrameResidual, FrameTimingReport } from './render-stage-timer';

/**
 * What the verdict needs beyond the wire report: how long the window is and what it left unbracketed. Why
 * `gpuMs` is absent is not in here — the report's `null` is what the verdict acts on, and the bench report
 * carries the timer's `gpuStatus` for the reader.
 */
export interface FrameEvidence {
  /** Frames the window covers. */
  readonly sampleCount: number;
  readonly residual: FrameResidual;
  /** The CPU clock's smallest step (timer-resolution.ts); `null` when it was not measured. */
  readonly timerResolutionMs: number | null;
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
  /** Rows the evidence cannot judge (a short window, no `gpuMs`, a clock too coarse), so their number is no verdict. */
  readonly unjudged: readonly BudgetRowName[];
  /** Stage rows whose budget no consumer clock resolves: reported, never judged, never `unjudged`. */
  readonly informational: readonly RenderStageName[];
  /** The clock's step the rows were read with, so the log can say why a row was left unjudged. */
  readonly timerResolutionMs: number | null;
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

/** Stage rows judged at all: budgets a consumer clock can resolve. */
const INFORMATIONAL_STAGES = RENDER_STAGE_NAMES.filter(
  (stage) => RENDER_STAGE_BUDGET_MS[stage] < RENDER_JUDGED_STAGE_BUDGET_MIN_MS,
);
const JUDGED_STAGES = RENDER_STAGE_NAMES.filter((stage) => !INFORMATIONAL_STAGES.includes(stage));

/** The budget of each row read off the CPU clock, the rows the clock's resolution decides. */
const CPU_CLOCK_ROW_BUDGET_MS: ReadonlyArray<readonly [BudgetRowName, number]> = [
  ...JUDGED_STAGES.map((stage): readonly [BudgetRowName, number] => [stage, RENDER_STAGE_BUDGET_MS[stage]]),
  [BUDGET_ROW.frame, RENDER_FRAME_BUDGET_P95_MS],
  [BUDGET_ROW.hud, RENDER_HUD_BUDGET_MS],
];

/** Every judged row whose number is a p95 (the whole verdict bar the draw-call count and the informational stages). */
function quantileRows(): BudgetRowName[] {
  return [...JUDGED_STAGES, BUDGET_ROW.frame, BUDGET_ROW.gpu, BUDGET_ROW.hud];
}

/** CPU-clock rows whose budget is under ten of the clock's steps; none when the step is unknown. */
function rowsTooFineForClock(timerResolutionMs: number | null): BudgetRowName[] {
  if (timerResolutionMs === null) return [];
  return CPU_CLOCK_ROW_BUDGET_MS.filter(
    ([, budgetMs]) => timerResolutionMs > budgetMs * RENDER_TIMER_RESOLUTION_BUDGET_FRACTION,
  ).map(([name]) => name);
}

function unjudgedRows(
  report: ClientPerformanceReport,
  evidence: FrameEvidence,
  isP95Estimable: boolean,
): BudgetRowName[] {
  if (!isP95Estimable) return quantileRows();
  return [...rowsTooFineForClock(evidence.timerResolutionMs), ...(report.gpuMs === null ? [BUDGET_ROW.gpu] : [])];
}

/** Compares a report with the §7 budgets; see the module comment for what the evidence leaves unjudged. */
export function budgetVerdict(report: ClientPerformanceReport, evidence: FrameEvidence): BudgetVerdict {
  const stagesTotalMs = RENDER_STAGE_NAMES.reduce((sum, stage) => sum + report.renderStagesMs[stage], 0);
  const isP95Estimable = evidence.sampleCount >= RENDER_P95_MIN_SAMPLE_FRAMES;
  const residualP95Ms = evidence.residual.p95Ms;
  const unjudged = unjudgedRows(report, evidence, isP95Estimable);
  const judged = (name: BudgetRowName): boolean => !unjudged.includes(name);
  const quantileOverruns = [
    ...JUDGED_STAGES.flatMap((stage) => overrunIf(stage, report.renderStagesMs[stage], RENDER_STAGE_BUDGET_MS[stage])),
    ...overrunIf(BUDGET_ROW.frame, report.frameTimeP95Ms, RENDER_FRAME_BUDGET_P95_MS),
    ...(report.gpuMs === null ? [] : overrunIf(BUDGET_ROW.gpu, report.gpuMs, RENDER_GPU_BUDGET_MS)),
    ...overrunIf(BUDGET_ROW.hud, residualP95Ms, RENDER_HUD_BUDGET_MS),
  ].filter((overrun) => judged(overrun.name));
  const overruns = [...quantileOverruns, ...overrunIf(BUDGET_ROW.drawCalls, report.drawCalls, RENDER_MAX_DRAW_CALLS)];
  return {
    isWithinBudget: overruns.length === 0,
    isFullyJudged: unjudged.length === 0,
    overruns,
    unjudged,
    informational: INFORMATIONAL_STAGES,
    timerResolutionMs: evidence.timerResolutionMs,
    stagesTotalMs,
    residualP95Ms,
    derivedResidualMs: report.frameTimeP95Ms - stagesTotalMs,
    sampleCount: evidence.sampleCount,
    isP95Estimable,
  };
}
