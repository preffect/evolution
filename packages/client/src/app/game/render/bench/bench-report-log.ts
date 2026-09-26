// What the bench route does with a finished report (docs/rendering/budget.md §7): the invisible `<pre>` the smoke
// and graphics-qa read by `data-testid`, and the console a human reads. Both sinks live in this one function, so a
// route cannot feed one of them and forget the other.
//
// **A quantile row is printed as a verdict only where the window can support one.** Below
// `RENDER_P95_MIN_SAMPLE_FRAMES` frames no p95 is estimable at all (§7, "Reading a report"), so those rows print
// the window that produced them instead of a comparison a reader would quote. A row the page's clock is too coarse
// for (ticket #504) prints its number marked unjudged with the clock's step, and an informational stage (a budget
// under `RENDER_JUDGED_STAGE_BUDGET_MIN_MS`, ticket #470) is marked as such in the stages row.
//
// **The gate row comes first** (ticket #264): whether the run is evidence at all (`bench-gate.ts`), and if not, what
// to change in the URL, so a within-budget verdict with the GPU unavailable is never read as a pass.

import { RENDER_STAGE_NAMES } from '@evolution/shared';
import {
  NOT_MEASURED,
  OVER_BUDGET,
  WITHIN_BUDGET,
  formatAgainstBudget,
  formatAgainstCount,
  formatMeasuredMilliseconds,
  formatMeasuredNumber,
  logMeasurementReport,
  measurementRow,
} from '../../measurement-log';
import {
  RENDER_FRAME_BUDGET_P95_MS,
  RENDER_GPU_BUDGET_MS,
  RENDER_HUD_BUDGET_MS,
  RENDER_MAX_DRAW_CALLS,
  RENDER_P95_MIN_SAMPLE_FRAMES,
} from '../constants';
import type { RenderBenchReport } from './bench-session';
import { BUDGET_ROW, type BudgetOverrun, type BudgetRowName } from './render-benchmark';

export const BENCH_REPORT_HEADING = 'Render bench';

/** `Render bench — seed 42, tick 0, zoom 8, 24 frames, parked`. */
export function benchReportHeading(report: RenderBenchReport): string {
  const scene = report.isTickAdvancing ? 'a tick a frame' : 'parked on one tick';
  return `${BENCH_REPORT_HEADING} — seed ${report.seed}, tick ${report.tick}, zoom ${report.zoom}, ${scene}`;
}

function overrunText(overrun: BudgetOverrun): string {
  return `${overrun.name} ${formatMeasuredNumber(overrun.measured)} > ${overrun.budget}`;
}

/** Why rows are unjudged on a long enough window: the clock's step, when it is what decided. */
function clockReason(report: RenderBenchReport): string {
  const { timerResolutionMs } = report.verdict;
  return `the page's clock steps ${formatMeasuredMilliseconds(timerResolutionMs)}`;
}

export const GATE_PASSED = 'PASS — evidence a PR may quote';
export const GATE_FAILED = 'FAIL — not evidence';

/** Why the gate failed, each with what the next run's URL changes. */
function gateReasons(report: RenderBenchReport): string[] {
  const { gate, verdict } = report;
  return [
    ...(verdict.isWithinBudget ? [] : ['over budget (see the verdict)']),
    ...(gate.unexpectedUnjudged.length === 0
      ? []
      : [`unjudged and not expected: ${gate.unexpectedUnjudged.join(', ')} (&expectUnjudged= names what may be)`]),
    ...(gate.isTickAdvancing ? [] : ['parked on one tick (pass &advance=1)']),
  ];
}

function gateValue(report: RenderBenchReport): string {
  const { gate } = report;
  const expected =
    gate.expectedUnjudged.length === 0 ? '' : ` (expected unjudged: ${gate.expectedUnjudged.join(', ')})`;
  if (gate.isPassed) return `${GATE_PASSED}${expected}`;
  return `${GATE_FAILED} — ${gateReasons(report).join('; ')}`;
}

/** The headline the rest of the block explains: what broke, or what the evidence could not judge. */
function verdictValue(report: RenderBenchReport): string {
  const { overruns, unjudged, isFullyJudged, isP95Estimable, timerResolutionMs } = report.verdict;
  if (overruns.length > 0) return `${OVER_BUDGET} — ${overruns.map((overrun) => overrunText(overrun)).join(', ')}`;
  if (isFullyJudged) return `${WITHIN_BUDGET} on every judged row`;
  const isClockCoarse = unjudged.some((row) => row !== BUDGET_ROW.gpu);
  const clockNote = isP95Estimable && timerResolutionMs !== null && isClockCoarse ? ` (${clockReason(report)})` : '';
  return `${WITHIN_BUDGET} where judged — unjudged: ${unjudged.join(', ')}${clockNote}`;
}

function stagesValue(report: RenderBenchReport): string {
  const { informational } = report.verdict;
  const noted = (stage: (typeof RENDER_STAGE_NAMES)[number]): string =>
    informational.includes(stage) ? ' (informational)' : '';
  return RENDER_STAGE_NAMES.map(
    (stage) => `${stage} ${formatMeasuredNumber(report.renderStagesMs[stage])}${noted(stage)}`,
  ).join(', ');
}

/** What the window itself was, so a number quoted out of this block carries its sample count and its load. */
function windowValue(report: RenderBenchReport): string {
  const growth = report.heapGrowthBytesPerFrame;
  const heap = growth === null ? NOT_MEASURED : `${Math.round(growth)} bytes/frame (a range over runs, never one)`;
  return `${report.verdict.sampleCount} frames, ${report.visibleCells} cells, ${report.visibleMotes} motes, heap ${heap}`;
}

/** A p95 row: against its budget, or its window or clock where the verdict could not judge it. */
function quantileRowValue(
  report: RenderBenchReport,
  row: BudgetRowName,
  measuredMs: number | null,
  budgetMs: number,
): string {
  const { isP95Estimable, sampleCount, unjudged } = report.verdict;
  if (!isP95Estimable) {
    return formatAgainstBudget(
      null,
      budgetMs,
      `a ${sampleCount}-frame window, under the ${RENDER_P95_MIN_SAMPLE_FRAMES} a p95 needs`,
    );
  }
  if (measuredMs === null) return formatAgainstBudget(null, budgetMs, report.gpuStatus);
  if (unjudged.includes(row)) return `${formatMeasuredMilliseconds(measuredMs)} — unjudged (${clockReason(report)})`;
  return formatAgainstBudget(measuredMs, budgetMs, report.gpuStatus);
}

/** The verdict and the numbers that decide it, budgets first; the object below carries everything else. */
export function benchReportHeadlines(report: RenderBenchReport): readonly string[] {
  const { residualP95Ms } = report.verdict;
  return [
    measurementRow('gate', gateValue(report)),
    measurementRow('verdict', verdictValue(report)),
    measurementRow(
      'frame p95',
      quantileRowValue(report, BUDGET_ROW.frame, report.frameTimeP95Ms, RENDER_FRAME_BUDGET_P95_MS),
    ),
    measurementRow('gpu p95', quantileRowValue(report, BUDGET_ROW.gpu, report.gpuMs, RENDER_GPU_BUDGET_MS)),
    measurementRow('hud p95', quantileRowValue(report, BUDGET_ROW.hud, residualP95Ms, RENDER_HUD_BUDGET_MS)),
    measurementRow('draw calls', `${formatAgainstCount(report.drawCalls, RENDER_MAX_DRAW_CALLS)} (the worst frame)`),
    measurementRow('stages p95', stagesValue(report)),
    measurementRow('window', windowValue(report)),
  ];
}

/** The finished report: into the element the smoke reads, and into the console a human reads. */
export function publishBenchReport(element: HTMLElement, report: RenderBenchReport): void {
  element.textContent = JSON.stringify(report);
  logMeasurementReport(benchReportHeading(report), benchReportHeadlines(report), report);
}
