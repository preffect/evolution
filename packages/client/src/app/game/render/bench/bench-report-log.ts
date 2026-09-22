// What the bench route does with a finished report (docs/rendering/budget.md §7): the invisible `<pre>` the smoke
// and graphics-qa read by `data-testid`, and the console a human reads. Both sinks live in this one function, so a
// route cannot feed one of them and forget the other.
//
// **A quantile row is printed as a verdict only where the window can support one.** Below
// `RENDER_P95_MIN_SAMPLE_FRAMES` frames no p95 is estimable at all (§7, "Reading a report"), so those rows print
// the window that produced them instead of a comparison a reader would quote.

import { RENDER_STAGE_NAMES } from '@evolution/shared';
import {
  NOT_MEASURED,
  OVER_BUDGET,
  WITHIN_BUDGET,
  formatAgainstBudget,
  formatAgainstCount,
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
import type { BudgetOverrun } from './render-benchmark';

export const BENCH_REPORT_HEADING = 'Render bench';

/** `Render bench — seed 42, tick 0, zoom 8, 24 frames, parked`. */
export function benchReportHeading(report: RenderBenchReport): string {
  const scene = report.isTickAdvancing ? 'a tick a frame' : 'parked on one tick';
  return `${BENCH_REPORT_HEADING} — seed ${report.seed}, tick ${report.tick}, zoom ${report.zoom}, ${scene}`;
}

function overrunText(overrun: BudgetOverrun): string {
  return `${overrun.name} ${formatMeasuredNumber(overrun.measured)} > ${overrun.budget}`;
}

/** The headline the rest of the block explains: what broke, or what the window could not judge. */
function verdictValue(report: RenderBenchReport): string {
  const { overruns, unjudged, isFullyJudged } = report.verdict;
  if (overruns.length > 0) return `${OVER_BUDGET} — ${overruns.map((overrun) => overrunText(overrun)).join(', ')}`;
  if (isFullyJudged) return `${WITHIN_BUDGET} on every row`;
  return `${WITHIN_BUDGET} where judged — unjudged: ${unjudged.join(', ')}`;
}

function stagesValue(report: RenderBenchReport): string {
  return RENDER_STAGE_NAMES.map((stage) => `${stage} ${formatMeasuredNumber(report.renderStagesMs[stage])}`).join(', ');
}

/** What the window itself was, so a number quoted out of this block carries its sample count and its load. */
function windowValue(report: RenderBenchReport): string {
  const growth = report.heapGrowthBytesPerFrame;
  const heap = growth === null ? NOT_MEASURED : `${Math.round(growth)} bytes/frame (a range over runs, never one)`;
  return `${report.verdict.sampleCount} frames, ${report.visibleCells} cells, ${report.visibleMotes} motes, heap ${heap}`;
}

/** The verdict and the numbers that decide it, budgets first; the object below carries everything else. */
export function benchReportHeadlines(report: RenderBenchReport): readonly string[] {
  const { isP95Estimable, sampleCount, residualP95Ms } = report.verdict;
  const windowReason = `a ${sampleCount}-frame window, under the ${RENDER_P95_MIN_SAMPLE_FRAMES} a p95 needs`;
  const estimable = (measured: number | null): number | null => (isP95Estimable ? measured : null);
  const gpuReason = report.gpuMs === null ? report.gpuStatus : windowReason;
  return [
    measurementRow('verdict', verdictValue(report)),
    measurementRow(
      'frame p95',
      formatAgainstBudget(estimable(report.frameTimeP95Ms), RENDER_FRAME_BUDGET_P95_MS, windowReason),
    ),
    measurementRow('gpu p95', formatAgainstBudget(estimable(report.gpuMs), RENDER_GPU_BUDGET_MS, gpuReason)),
    measurementRow('hud p95', formatAgainstBudget(estimable(residualP95Ms), RENDER_HUD_BUDGET_MS, windowReason)),
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
