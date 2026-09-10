import { describe, expect, it } from 'vitest';
import {
  formatValue,
  isDeepEqual,
  matchToBe,
  matchToBeAtLeast,
  matchToBeAtMost,
  matchToBeBetween,
  matchToBeCloseTo,
  matchToBeGreaterThan,
  matchToBeLessThan,
  matchToBeNull,
  matchToEqual,
  matchToSatisfy,
} from './matchers.js';

describe('equality matchers', () => {
  it('matchToBe uses identity semantics and renders both sides', () => {
    expect(matchToBe(2)(2).isMatch).toBe(true);
    expect(matchToBe(2)(3)).toEqual({ isMatch: false, expected: '2', actual: '3' });
    expect(matchToBe(Number.NaN)(Number.NaN).isMatch).toBe(true);
  });

  it('matchToEqual compares structurally', () => {
    expect(matchToEqual({ x: 1, list: [1, 2] })({ list: [1, 2], x: 1 }).isMatch).toBe(true);
    expect(matchToEqual([1, 2])([2, 1]).isMatch).toBe(false);
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

describe('matchToBeCloseTo', () => {
  it('holds within the tolerance inclusive and reports the distance', () => {
    expect(matchToBeCloseTo(110.1, 0.5)(110.6).isMatch).toBe(true);
    const miss = matchToBeCloseTo(110.1, 0.5)(95.2);
    expect(miss.isMatch).toBe(false);
    expect(miss.expected).toBe('110.1 ± 0.5');
    expect(miss.actual).toBe('95.2 (off by 14.9)');
  });

  it('rounds "off by" to the precision the tolerance is stated to', () => {
    expect(matchToBeCloseTo(115.92003865463975, 0.01)(110.4).actual).toBe('110.4 (off by 5.52)');
    expect(matchToBeCloseTo(0, 0)(42).actual).toBe('42 (off by 42)');
    expect(matchToBeCloseTo(1, 1e-9)(1.5).actual).toBe('1.5 (off by 0.5)');
  });

  it('rejects a non-number without throwing', () => {
    const outcome = matchToBeCloseTo(1, 1)('one');
    expect(outcome.isMatch).toBe(false);
    expect(outcome.actual).toBe('"one"');
    expect(matchToBeCloseTo(1, 1)(undefined).actual).toBe('undefined');
  });
});

describe('bound matchers', () => {
  it('render the bound from the numbers and fail a non-number', () => {
    expect(matchToBeLessThan(0.01)(0.005).isMatch).toBe(true);
    expect(matchToBeLessThan(0.01)(0.01)).toEqual({ isMatch: false, expected: 'less than 0.01', actual: '0.01' });
    expect(matchToBeGreaterThan(5)(6).isMatch).toBe(true);
    expect(matchToBeGreaterThan(5)(5)).toEqual({ isMatch: false, expected: 'greater than 5', actual: '5' });
    expect(matchToBeAtLeast(5)(5).isMatch).toBe(true);
    expect(matchToBeAtLeast(5)(4.9).expected).toBe('at least 5');
    expect(matchToBeAtMost(5)(5).isMatch).toBe(true);
    expect(matchToBeAtMost(5)(5.1).expected).toBe('at most 5');
    expect(matchToBeAtLeast(5)(undefined)).toEqual({ isMatch: false, expected: 'at least 5', actual: 'undefined' });
  });

  it('matchToBeBetween is inclusive on both ends', () => {
    expect([69, 70, 72, 74, 75].map((count) => matchToBeBetween(70, 74)(count).isMatch)).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
    expect(matchToBeBetween(70, 74)(69).expected).toBe('between 70 and 74');
  });
});

describe('isDeepEqual and formatValue', () => {
  it('treats nested plain data structurally and everything else by identity', () => {
    expect(isDeepEqual({ a: { b: [1, { c: null }] } }, { a: { b: [1, { c: null }] } })).toBe(true);
    expect(isDeepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(isDeepEqual([1], { 0: 1 })).toBe(false);
  });

  it('renders scalars and objects as JSON and falls back for cycles and what JSON cannot render', () => {
    expect(formatValue('x')).toBe('"x"');
    expect(formatValue(undefined)).toBe('undefined');
    expect(formatValue({ a: [1] })).toBe('{"a":[1]}');
    expect(formatValue(Symbol('offer'))).toBe('Symbol(offer)');
    expect(formatValue(() => 1)).toContain('=>');
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(formatValue(cyclic)).toBe('[object Object]');
  });
});
