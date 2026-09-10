import { describe, expect, it } from 'vitest';
import { playerId } from '@evolution/shared';
import {
  AT_END,
  evaluateExpectation,
  expectationsDueAt,
  formatValue,
  isDeepEqual,
  matchToBe,
  matchToBeCloseTo,
  matchToBeNull,
  matchToEqual,
  matchToSatisfy,
  type Expectation,
  type Matcher,
  type ScenarioView,
} from './expectations.js';

/** What the builder does when it registers a typed matcher against the untyped expectation list. */
function untyped<Value>(matcher: Matcher<Value>): Matcher<unknown> {
  return matcher as Matcher<unknown>;
}

function viewAt(tick: number, snapshot: unknown = null): ScenarioView<unknown> {
  return { tick, seed: 42, snapshot, playerId: (index) => playerId(`player_${index}`), cell: () => undefined };
}

function expectation(overrides: Partial<Expectation<unknown>>): Expectation<unknown> {
  return { tick: 0, label: 'value', select: (view) => view.snapshot, match: untyped(matchToBe(null)), ...overrides };
}

describe('matchers', () => {
  it('matchToBe uses identity semantics and renders both sides', () => {
    expect(matchToBe(2)(2).isMatch).toBe(true);
    expect(matchToBe(2)(3)).toEqual({ isMatch: false, expected: '2', actual: '3' });
    expect(matchToBe(Number.NaN)(Number.NaN).isMatch).toBe(true);
  });

  it('matchToEqual compares structurally', () => {
    expect(matchToEqual({ x: 1, list: [1, 2] })({ list: [1, 2], x: 1 }).isMatch).toBe(true);
    expect(matchToEqual([1, 2])([2, 1]).isMatch).toBe(false);
  });

  it('matchToBeCloseTo holds within the tolerance inclusive and reports the distance', () => {
    expect(matchToBeCloseTo(110.1, 0.5)(110.6).isMatch).toBe(true);
    const miss = matchToBeCloseTo(110.1, 0.5)(95.2);
    expect(miss.isMatch).toBe(false);
    expect(miss.expected).toBe('110.1 ± 0.5');
    expect(miss.actual).toContain('95.2 (off by ');
  });

  it('matchToBeCloseTo rejects a non-number without throwing', () => {
    const outcome = matchToBeCloseTo(1, 1)('one');
    expect(outcome.isMatch).toBe(false);
    expect(outcome.actual).toBe('"one"');
    expect(matchToBeCloseTo(1, 1)(undefined).actual).toBe('undefined');
  });

  it('matchToBeNull holds for null only', () => {
    expect(matchToBeNull()(null).isMatch).toBe(true);
    expect(matchToBeNull()(undefined)).toEqual({ isMatch: false, expected: 'null', actual: 'undefined' });
  });

  it('matchToSatisfy reports the description as the expectation', () => {
    const outcome = matchToSatisfy((value: number) => value > 5, 'greater than 5')(3);
    expect(outcome).toEqual({ isMatch: false, expected: 'greater than 5', actual: '3' });
  });
});

describe('isDeepEqual and formatValue', () => {
  it('treats nested plain data structurally and everything else by identity', () => {
    expect(isDeepEqual({ a: { b: [1, { c: null }] } }, { a: { b: [1, { c: null }] } })).toBe(true);
    expect(isDeepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(isDeepEqual([1], { 0: 1 })).toBe(false);
  });

  it('renders scalars and objects as JSON and falls back for cycles', () => {
    expect(formatValue('x')).toBe('"x"');
    expect(formatValue(undefined)).toBe('undefined');
    expect(formatValue({ a: [1] })).toBe('{"a":[1]}');
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(formatValue(cyclic)).toBe('[object Object]');
  });
});

describe('evaluateExpectation', () => {
  it('returns null when the expectation holds', () => {
    expect(evaluateExpectation(expectation({ match: untyped(matchToBe(7)) }), viewAt(3, 7))).toBeNull();
  });

  it('returns the tick, label and both rendered values when it fails', () => {
    const failure = evaluateExpectation(expectation({ label: 'mass', match: untyped(matchToBe(7)) }), viewAt(3, 8));
    expect(failure).toEqual({ tick: 3, label: 'mass', expected: '7', actual: '8' });
  });
});

describe('expectationsDueAt', () => {
  it('selects by tick and resolves AT_END to the final tick', () => {
    const atThree = expectation({ tick: 3 });
    const atEnd = expectation({ tick: AT_END });
    expect(expectationsDueAt([atThree, atEnd], 3, 10)).toEqual([atThree]);
    expect(expectationsDueAt([atThree, atEnd], 10, 10)).toEqual([atEnd]);
    expect(expectationsDueAt([atThree, atEnd], 3, 3)).toEqual([atThree, atEnd]);
  });
});
