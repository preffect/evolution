// The matchers behind `.toBe`, `.toBeCloseTo`, `.toBeBetween` … (docs/TESTING.md §8.1). Each one
// answers whether the selected value holds and renders both sides for the failure output; the
// numeric ones are typed over `unknown` so a selector that may yield `undefined` (a cell that is
// gone) fails with the value shown instead of being rejected at compile time.

export interface MatchOutcome {
  readonly isMatch: boolean;
  readonly expected: string;
  readonly actual: string;
}

export type Matcher<Value> = (actual: Value) => MatchOutcome;

const DEFAULT_TOLERANCE = 0;
const DECIMAL_SEPARATOR = '.';

/** Renders a value for a failure message; what JSON cannot render falls back to `String`. */
export function formatValue(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  try {
    return JSON.stringify(value) ?? String(value);
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

/** The decimal places a tolerance is stated to ("± 0.01" → 2), so "off by" prints at that precision. */
function decimalPlacesOf(tolerance: number): number {
  const [, fraction = ''] = String(tolerance).split(DECIMAL_SEPARATOR);
  return fraction.length;
}

/** `|actual − expected| ≤ tolerance`; the design tables state tolerances as "± 0.01". */
export function matchToBeCloseTo(expected: number, tolerance = DEFAULT_TOLERANCE): Matcher<unknown> {
  const precision = decimalPlacesOf(tolerance);
  return (actual) => {
    if (typeof actual !== 'number') {
      return { isMatch: false, expected: `${expected} ± ${tolerance}`, actual: formatValue(actual) };
    }
    const distance = Math.abs(actual - expected);
    const offBy = precision === 0 ? distance : Number(distance.toFixed(precision));
    return {
      isMatch: distance <= tolerance,
      expected: `${expected} ± ${tolerance}`,
      actual: `${formatValue(actual)} (off by ${offBy})`,
    };
  };
}

/** A numeric bound: a non-number never matches and is shown as it is. */
function matchNumber(holds: (actual: number) => boolean, expected: string): Matcher<unknown> {
  return (actual) => ({
    isMatch: typeof actual === 'number' && holds(actual),
    expected,
    actual: formatValue(actual),
  });
}

export function matchToBeLessThan(bound: number): Matcher<unknown> {
  return matchNumber((actual) => actual < bound, `less than ${bound}`);
}

export function matchToBeGreaterThan(bound: number): Matcher<unknown> {
  return matchNumber((actual) => actual > bound, `greater than ${bound}`);
}

export function matchToBeAtLeast(bound: number): Matcher<unknown> {
  return matchNumber((actual) => actual >= bound, `at least ${bound}`);
}

export function matchToBeAtMost(bound: number): Matcher<unknown> {
  return matchNumber((actual) => actual <= bound, `at most ${bound}`);
}

/** Inclusive on both ends ("between 70 and 74"). */
export function matchToBeBetween(low: number, high: number): Matcher<unknown> {
  return matchNumber((actual) => actual >= low && actual <= high, `between ${low} and ${high}`);
}

export function matchToSatisfy<Value>(predicate: (actual: Value) => boolean, description: string): Matcher<Value> {
  return (actual) => ({ isMatch: predicate(actual), expected: description, actual: formatValue(actual) });
}
