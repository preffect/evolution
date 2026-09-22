// Printing a dev route's measurement report to the browser console (docs/rendering/budget.md §7, §7.1).
//
// The bench route and the encyclopedia preview route both write their report into a `<pre>` that is deliberately
// invisible — `opacity: 0`, so a stage screenshot carries no text — and read it back by `data-testid`. That leaves
// a human who opens the URL with nothing at all on screen, which is what ticket #492 fixes: the same report is
// printed here as well, a headline block a person reads at a glance and then the object, expandable in devtools.
//
// **The one `console.log` in the repository.** `no-console` allows only `error` and `warn` everywhere else
// (CODE-STANDARDS §9): those two are the error channel, and both devtools' filters and the e2e smokes' console
// watchers read them as failures. A measurement report is output, not a problem — so this file carries the scoped
// `no-console` override in `eslint.config.js`, every route's report goes through it, and no other file needs one.

import { PERCENT } from './quantities/quantity-unit';

/** How a measurement is quoted: two decimals is finer than any budget on either route's tables. */
const MEASURED_DECIMALS = 2;
/** A share is read at a glance, never to a decimal. */
const SHARE_DECIMALS = 0;
/** Wide enough for the longest row label either route uses, so the numbers line up under each other. */
const ROW_LABEL_WIDTH = 10;
const HEADLINE_INDENT = '  ';

/** What stands where a number could not be taken: never a zero, never a dash (docs/rendering/budget.md §7). */
export const NOT_MEASURED = 'not measured';
export const WITHIN_BUDGET = 'within budget';
export const OVER_BUDGET = 'OVER BUDGET';

/** A measured figure, unitless: `18.40`. `NOT_MEASURED` for anything that is not a finite number. */
export function formatMeasuredNumber(value: number | null): string {
  return value === null || !Number.isFinite(value) ? NOT_MEASURED : value.toFixed(MEASURED_DECIMALS);
}

/** The same with its unit: `18.40 ms`. */
export function formatMeasuredMilliseconds(milliseconds: number | null): string {
  const figure = formatMeasuredNumber(milliseconds);
  return figure === NOT_MEASURED ? figure : `${figure} ms`;
}

/**
 * One budget row as a human reads it — `4.21 ms / budget 12 ms — within budget` — or `unmeasuredReason` in place
 * of a verdict where the run could not support one. The reason says what would produce the number, because a
 * route that prints nothing leaves a reader unable to tell a slow run from a broken one.
 */
export function formatAgainstBudget(measuredMs: number | null, budgetMs: number, unmeasuredReason: string): string {
  if (measuredMs === null || !Number.isFinite(measuredMs)) return `${NOT_MEASURED} (${unmeasuredReason})`;
  const verdict = measuredMs <= budgetMs ? WITHIN_BUDGET : OVER_BUDGET;
  return `${formatMeasuredMilliseconds(measuredMs)} / budget ${budgetMs} ms — ${verdict}`;
}

/** A count against its ceiling: `17 / max 20 — within budget`. */
export function formatAgainstCount(measured: number, maximum: number): string {
  return `${measured} / max ${maximum} — ${measured <= maximum ? WITHIN_BUDGET : OVER_BUDGET}`;
}

/** A span's share of the whole it sits inside: `71%`, or `NOT_MEASURED` where there is no whole to divide by. */
export function formatShare(part: number, whole: number): string {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return NOT_MEASURED;
  return `${((part / whole) * PERCENT).toFixed(SHARE_DECIMALS)}%`;
}

/** One headline row: a padded label, then its value. */
export function measurementRow(label: string, value: string): string {
  return `${label.padEnd(ROW_LABEL_WIDTH)} ${value}`;
}

/** The headline block, then the report object itself, so devtools can expand what the headlines summarise. */
export function logMeasurementReport(heading: string, headlines: readonly string[], report: unknown): void {
  console.log([heading, ...headlines.map((line) => `${HEADLINE_INDENT}${line}`)].join('\n'), report);
}

/** A route that produced no report at all: the only thing worse than an unreadable number is silence. */
export function logMeasurementFailure(heading: string, reason: string): void {
  console.error(`${heading}: no report — ${reason}`);
}
