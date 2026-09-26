// The first place two plain-data values differ, so a failure can name a field instead of a hash
// (docs/testing/scenario-runner.md §8.2). Objects are walked in the expected side's key order, then
// the keys only the actual side has; arrays and typed arrays by index; Maps by key. Anything else
// compares with `Object.is`. Values are rendered as bounded one-line text for the failure output.

export interface StructuralDifference {
  /** `$` for the root, then `.key`, `["odd key"]`, `[index]` or `.get(key)` per step down. */
  readonly path: string;
  /** `MISSING_VALUE` when the key or index is absent on that side. */
  readonly expected: unknown;
  readonly actual: unknown;
}

export const ROOT_PATH = '$';
/** Stands for a key or an index one side does not have. */
export const MISSING_VALUE: unique symbol = Symbol('missing');
/** A rendered value longer than this is cut, so one huge array cannot bury the report. */
export const MAX_RENDERED_VALUE_LENGTH = 160;
const TRUNCATION_MARK = '…';
const IDENTIFIER_PATTERN = /^[A-Za-z_$][\w$]*$/;

type Indexed = ArrayLike<unknown>;

function isIndexed(value: unknown): value is Indexed {
  return Array.isArray(value) || (ArrayBuffer.isView(value) && !(value instanceof DataView));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !isIndexed(value) && !(value instanceof Map);
}

function keyPath(path: string, key: string): string {
  return IDENTIFIER_PATTERN.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}

function orderedKeys<Key>(expected: Iterable<Key>, actual: Iterable<Key>): Key[] {
  const keys = [...expected];
  const known = new Set(keys);
  return keys.concat([...actual].filter((key) => !known.has(key)));
}

function firstDifferenceInIndexed(expected: Indexed, actual: Indexed, path: string): StructuralDifference | null {
  const length = Math.max(expected.length, actual.length);
  for (let index = 0; index < length; index += 1) {
    const difference = findFirstDifference(
      index < expected.length ? expected[index] : MISSING_VALUE,
      index < actual.length ? actual[index] : MISSING_VALUE,
      `${path}[${index}]`,
    );
    if (difference !== null) {
      return difference;
    }
  }
  return null;
}

function firstDifferenceInMaps(
  expected: ReadonlyMap<unknown, unknown>,
  actual: ReadonlyMap<unknown, unknown>,
  path: string,
): StructuralDifference | null {
  for (const key of orderedKeys(expected.keys(), actual.keys())) {
    const difference = findFirstDifference(
      expected.has(key) ? expected.get(key) : MISSING_VALUE,
      actual.has(key) ? actual.get(key) : MISSING_VALUE,
      `${path}.get(${renderValue(key)})`,
    );
    if (difference !== null) {
      return difference;
    }
  }
  return null;
}

function firstDifferenceInRecords(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
  path: string,
): StructuralDifference | null {
  for (const key of orderedKeys(Object.keys(expected), Object.keys(actual))) {
    const difference = findFirstDifference(
      Object.hasOwn(expected, key) ? expected[key] : MISSING_VALUE,
      Object.hasOwn(actual, key) ? actual[key] : MISSING_VALUE,
      keyPath(path, key),
    );
    if (difference !== null) {
      return difference;
    }
  }
  return null;
}

/** The first differing path between `expected` and `actual`, or `null` when they are structurally equal. */
export function findFirstDifference(
  expected: unknown,
  actual: unknown,
  path: string = ROOT_PATH,
): StructuralDifference | null {
  if (Object.is(expected, actual)) {
    return null;
  }
  if (isIndexed(expected) && isIndexed(actual)) {
    return firstDifferenceInIndexed(expected, actual, path);
  }
  if (expected instanceof Map && actual instanceof Map) {
    return firstDifferenceInMaps(expected, actual, path);
  }
  if (isRecord(expected) && isRecord(actual)) {
    return firstDifferenceInRecords(expected, actual, path);
  }
  return { path, expected, actual };
}

function truncate(text: string): string {
  return text.length <= MAX_RENDERED_VALUE_LENGTH
    ? text
    : `${text.slice(0, MAX_RENDERED_VALUE_LENGTH - TRUNCATION_MARK.length)}${TRUNCATION_MARK}`;
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  return typeof value === 'bigint' ? `${value}n` : value;
}

/** One bounded line for a value on either side of a difference. */
export function renderValue(value: unknown): string {
  if (value === MISSING_VALUE) {
    return '(missing)';
  }
  if (typeof value === 'number') {
    return Object.is(value, -0) ? '-0' : String(value);
  }
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return String(value);
  }
  return truncate(JSON.stringify(value, jsonReplacer));
}
