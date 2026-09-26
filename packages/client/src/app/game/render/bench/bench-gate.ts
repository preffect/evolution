// Whether a bench run is evidence a PR may quote against the §7 budgets (docs/rendering/budget.md §7.3, ticket
// #264). The verdict's `isWithinBudget` only covers the rows it could judge, so on its own a run whose GPU timer was
// unavailable reads as a pass. The gate closes that: it passes only when the verdict is within budget, the window was
// long enough to hold a p95, every row the verdict left unjudged was **expected** unjudged by the run's own URL
// (`expectUnjudged=gpu`, named up front rather than excused after), and the scene advanced a tick a frame
// (`advance=1`), because a parked window measures the interpolation half of `net` only.

import { BUDGET_ROW, type BudgetRowName, type BudgetVerdict } from './render-benchmark';

/**
 * The rows a URL may excuse: those a real machine can be unable to measure. Only `gpu` — whether the browser exposes
 * `EXT_disjoint_timer_query_webgl2` depends on the browser, its version and the GPU. Every CPU-clock row is judged on
 * the hardware run's browser (Chrome's 0.1 ms step resolves every budget of 1 ms or more), and a short window is
 * refused outright, so excusing any other row would only ever hide a run that is not evidence.
 */
export const EXPECTABLE_UNJUDGED_ROWS: readonly BudgetRowName[] = [BUDGET_ROW.gpu];

export interface BenchGate {
  /** Within budget, a p95-sized window, fully judged but for the expected rows, and a tick a frame. */
  readonly isPassed: boolean;
  /** The rows the run's URL said it expected unjudged, limited to `EXPECTABLE_UNJUDGED_ROWS`. */
  readonly expectedUnjudged: readonly BudgetRowName[];
  /** Rows the verdict left unjudged that the URL did not expect: each one fails the gate. */
  readonly unexpectedUnjudged: readonly BudgetRowName[];
  /** Whether the window held enough frames for a p95; a shorter one (`window=`) fails the gate. */
  readonly isP95Estimable: boolean;
  /** Whether the scene advanced a tick a frame; a parked window fails the gate. */
  readonly isTickAdvancing: boolean;
}

/** `gpu` → the excusable rows in it; any other name is dropped, which can only fail the gate, never pass it. */
export function parseExpectedUnjudged(value: string | null): BudgetRowName[] {
  if (value === null) return [];
  const names = value.split(',').map((name) => name.trim());
  return EXPECTABLE_UNJUDGED_ROWS.filter((row) => names.includes(row));
}

export function benchGate(
  verdict: BudgetVerdict,
  isTickAdvancing: boolean,
  expectedUnjudged: readonly BudgetRowName[],
): BenchGate {
  const excused = expectedUnjudged.filter((row) => EXPECTABLE_UNJUDGED_ROWS.includes(row));
  const unexpectedUnjudged = verdict.unjudged.filter((row) => !excused.includes(row));
  const { isP95Estimable } = verdict;
  return {
    isPassed: verdict.isWithinBudget && isP95Estimable && unexpectedUnjudged.length === 0 && isTickAdvancing,
    expectedUnjudged: excused,
    unexpectedUnjudged,
    isP95Estimable,
    isTickAdvancing,
  };
}
