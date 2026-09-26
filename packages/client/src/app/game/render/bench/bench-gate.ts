// Whether a bench run is evidence a PR may quote against the §7 budgets (docs/rendering/budget.md §7, "The
// hardware run", ticket #264). The verdict's `isWithinBudget` only covers the rows it could judge, so on its own a
// run whose GPU timer was unavailable reads as a pass. The gate closes that: it passes only when the verdict is
// within budget, every row the verdict left unjudged was **expected** unjudged by the run's own URL
// (`expectUnjudged=gpu,…`, named up front rather than excused after), and the scene advanced a tick a frame
// (`advance=1`), because a parked window measures the interpolation half of `net` only.

import { RENDER_STAGE_NAMES } from '@evolution/shared';
import { BUDGET_ROW, type BudgetRowName, type BudgetVerdict } from './render-benchmark';

/** Every row a verdict can name, the values `expectUnjudged=` accepts. */
export const BUDGET_ROW_NAMES: readonly BudgetRowName[] = [...RENDER_STAGE_NAMES, ...Object.values(BUDGET_ROW)];

export interface BenchGate {
  /** Within budget, fully judged but for the expected rows, and a tick a frame: numbers a PR may quote. */
  readonly isPassed: boolean;
  /** The rows the run's URL said it expected unjudged. */
  readonly expectedUnjudged: readonly BudgetRowName[];
  /** Rows the verdict left unjudged that the URL did not expect: each one fails the gate. */
  readonly unexpectedUnjudged: readonly BudgetRowName[];
  /** Whether the scene advanced a tick a frame; a parked window fails the gate. */
  readonly isTickAdvancing: boolean;
}

/** `gpu,hud` → the valid row names in it; an unknown name is dropped, which can only fail the gate, never pass it. */
export function parseExpectedUnjudged(value: string | null): BudgetRowName[] {
  if (value === null) return [];
  const names = value.split(',').map((name) => name.trim());
  return BUDGET_ROW_NAMES.filter((row) => names.includes(row));
}

export function benchGate(
  verdict: BudgetVerdict,
  isTickAdvancing: boolean,
  expectedUnjudged: readonly BudgetRowName[],
): BenchGate {
  const unexpectedUnjudged = verdict.unjudged.filter((row) => !expectedUnjudged.includes(row));
  return {
    isPassed: verdict.isWithinBudget && unexpectedUnjudged.length === 0 && isTickAdvancing,
    expectedUnjudged,
    unexpectedUnjudged,
    isTickAdvancing,
  };
}
