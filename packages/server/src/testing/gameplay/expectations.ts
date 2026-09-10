// Assertions with tolerances (docs/TESTING.md §8). An expectation selects a value from the view
// at a tick and matches it; a failed match is reported with the tick, the label and both values
// rather than thrown on the spot, so one run reports every failure and its replay at once.

import type { PlayerId } from '@evolution/shared';
import type { CellLocation } from './adapter.js';
import type { ExpectationFailure } from './errors.js';

/** What a selector sees: the tick's snapshot plus the roster and cell lookups. */
export interface ScenarioView<Snapshot> {
  readonly tick: number;
  readonly seed: number;
  readonly snapshot: Snapshot;
  playerId(playerIndex: number): PlayerId;
  cell(playerIndex: number): CellLocation | undefined;
}

export type Selector<Snapshot, Value> = (view: ScenarioView<Snapshot>) => Value;

export interface MatchOutcome {
  readonly isMatch: boolean;
  readonly expected: string;
  readonly actual: string;
}

export type Matcher<Value> = (actual: Value) => MatchOutcome;

/** The pseudo-tick meaning "after the last step of the scenario". */
export const AT_END = 'end';
export type ExpectationTick = number | typeof AT_END;

export interface Expectation<Snapshot> {
  readonly tick: ExpectationTick;
  readonly label: string;
  readonly select: Selector<Snapshot, unknown>;
  readonly match: Matcher<unknown>;
}

const DEFAULT_TOLERANCE = 0;

/** Renders a value for a failure message; unrenderable values fall back to `String`. */
export function formatValue(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Structural equality over plain data (arrays, objects, scalars); order matters for arrays. */
export function isDeepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => isDeepEqual(item, right[index]));
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return isDeepEqual(leftKeys, rightKeys) && leftKeys.every((key) => isDeepEqual(left[key], right[key]));
  }
  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function matchToBe<Value>(expected: Value): Matcher<Value> {
  return (actual) => ({
    isMatch: Object.is(actual, expected),
    expected: formatValue(expected),
    actual: formatValue(actual),
  });
}

export function matchToEqual<Value>(expected: Value): Matcher<Value> {
  return (actual) => ({
    isMatch: isDeepEqual(actual, expected),
    expected: formatValue(expected),
    actual: formatValue(actual),
  });
}

/** Holds only for `null`; a missing cell or input reads as `undefined` and fails. */
export function matchToBeNull(): Matcher<unknown> {
  return (actual) => ({ isMatch: actual === null, expected: 'null', actual: formatValue(actual) });
}

/**
 * `|actual − expected| ≤ tolerance`; the design tables state tolerances as "± 0.01". Typed over
 * `unknown` so a selector that may yield `undefined` (a cell that is gone) fails with the value
 * shown instead of being rejected at compile time.
 */
export function matchToBeCloseTo(expected: number, tolerance = DEFAULT_TOLERANCE): Matcher<unknown> {
  return (actual) => {
    const isMatch = typeof actual === 'number' && Math.abs(actual - expected) <= tolerance;
    const offBy = typeof actual === 'number' ? ` (off by ${formatValue(Math.abs(actual - expected))})` : '';
    return { isMatch, expected: `${expected} ± ${tolerance}`, actual: `${formatValue(actual)}${offBy}` };
  };
}

export function matchToSatisfy<Value>(predicate: (actual: Value) => boolean, description: string): Matcher<Value> {
  return (actual) => ({ isMatch: predicate(actual), expected: description, actual: formatValue(actual) });
}

/** Evaluates one expectation against a view; `null` when it holds. */
export function evaluateExpectation<Snapshot>(
  expectation: Expectation<Snapshot>,
  view: ScenarioView<Snapshot>,
): ExpectationFailure | null {
  const outcome = expectation.match(expectation.select(view));
  if (outcome.isMatch) {
    return null;
  }
  return { tick: view.tick, label: expectation.label, expected: outcome.expected, actual: outcome.actual };
}

/** The expectations due at `tick`, resolving `AT_END` against `finalTick`. */
export function expectationsDueAt<Snapshot>(
  expectations: readonly Expectation<Snapshot>[],
  tick: number,
  finalTick: number,
): Expectation<Snapshot>[] {
  return expectations.filter((expectation) => resolveExpectationTick(expectation.tick, finalTick) === tick);
}

export function resolveExpectationTick(tick: ExpectationTick, finalTick: number): number {
  return tick === AT_END ? finalTick : tick;
}
