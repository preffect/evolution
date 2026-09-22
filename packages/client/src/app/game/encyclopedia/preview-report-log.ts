// What the preview evidence route does with a finished report (docs/rendering/budget.md §7.1): the invisible
// `<pre>` the smoke and graphics-qa read by `data-testid`, and the console a human reads. Both sinks live in this
// one function, so a route cannot feed one of them and forget the other.
//
// Every number here comes off the report — the two budgets included, which is why this file imports no tunable
// (docs/architecture/encyclopedia.md §12.6: the encyclopedia reads numbers from what it is handed, never from a
// module import).

import type { PreviewOpenTimings } from '../render/preview/preview-timings';
import {
  formatAgainstBudget,
  formatMeasuredMilliseconds,
  formatShare,
  logMeasurementFailure,
  logMeasurementReport,
  measurementRow,
} from '../measurement-log';
import type { PreviewRouteFailure, PreviewRouteReport } from './preview-route';

export const PREVIEW_REPORT_HEADING = 'Encyclopedia preview evidence';

/** `Encyclopedia preview evidence — cell (trait:flagellum), parked at 1 s, 3 opens`. */
export function previewReportHeading(report: PreviewRouteReport): string {
  const subject = report.anchor === null ? report.scene : `${report.scene} (${report.anchor})`;
  const opens = `${report.opens} open${report.opens === 1 ? '' : 's'}`;
  return `${PREVIEW_REPORT_HEADING} — ${subject}, parked at ${report.parkAtSeconds} s, ${opens}`;
}

/** Why there is no open p95: the cold open is reported apart and never judged, so one open leaves none. */
function warmOpenReason(report: PreviewRouteReport): string {
  return `${report.warmOpens.length} warm opens — the cold open is never judged; pass &opens=20`;
}

/** The cold open with its three-way split, the bake as a share of the whole: §7.1's first lever. */
function coldOpenValue(coldOpen: PreviewOpenTimings): string {
  const bakeShare = formatShare(coldOpen.bakeMs, coldOpen.openedToFirstFrameMs);
  const split = [
    `init ${formatMeasuredMilliseconds(coldOpen.initMs)}`,
    `bake ${formatMeasuredMilliseconds(coldOpen.bakeMs)} (${bakeShare} of it)`,
    `first submit ${formatMeasuredMilliseconds(coldOpen.firstSubmitMs)}`,
  ];
  return `${formatMeasuredMilliseconds(coldOpen.openedToFirstFrameMs)} — ${split.join(', ')}`;
}

/** The verdict and the numbers that decide it, budgets first; the object below carries everything else. */
export function previewReportHeadlines(report: PreviewRouteReport): readonly string[] {
  return [
    measurementRow('open p95', formatAgainstBudget(report.openP95Ms, report.budgets.openMs, warmOpenReason(report))),
    measurementRow(
      'frame p95',
      formatAgainstBudget(report.frame.frameTimeP95Ms, report.budgets.frameMs, 'no frame sample'),
    ),
    measurementRow('cold open', coldOpenValue(report.coldOpen)),
  ];
}

/** The finished report: into the element the smoke reads, and into the console a human reads. */
export function publishPreviewReport(element: HTMLElement, report: PreviewRouteReport): void {
  element.textContent = JSON.stringify(report);
  logMeasurementReport(previewReportHeading(report), previewReportHeadlines(report), report);
}

/** The same for a run that produced nothing: the element the smoke reads, and the reason in the console. */
export function publishPreviewFailure(element: HTMLElement, failure: PreviewRouteFailure): void {
  element.textContent = JSON.stringify(failure);
  logMeasurementFailure(PREVIEW_REPORT_HEADING, failure.error);
}
