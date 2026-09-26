import { describe, expect, it } from 'vitest';
import { findFirstDifference, MAX_RENDERED_VALUE_LENGTH, MISSING_VALUE, renderValue } from './structural-diff.js';

describe('findFirstDifference', () => {
  it('finds nothing between structurally equal values, NaN included', () => {
    const value = { tick: 3, cells: { a: { x: 1, y: [1, 2] } }, owners: new Map([['a', 1]]), score: Number.NaN };
    const copy = { tick: 3, cells: { a: { x: 1, y: [1, 2] } }, owners: new Map([['a', 1]]), score: Number.NaN };
    expect(findFirstDifference(value, copy)).toBeNull();
  });

  it('names the first differing leaf in the expected side key order', () => {
    const expected = { tick: 1, cells: { p0: { x: 43, y: 0, targetX: 72 } }, z: 1 };
    const actual = { tick: 1, cells: { p0: { x: 43, y: 0, targetX: 82 } }, z: 2 };
    expect(findFirstDifference(expected, actual)).toEqual({
      path: '$.cells.p0.targetX',
      expected: 72,
      actual: 82,
    });
  });

  it('quotes keys that are not identifiers and indexes arrays', () => {
    expect(findFirstDifference({ 'a-b': [1, 2] }, { 'a-b': [1, 3] })?.path).toBe('$["a-b"][1]');
  });

  it('reports a key or an index only one side has as missing', () => {
    expect(findFirstDifference({ a: 1 }, { a: 1, b: 2 })).toEqual({ path: '$.b', expected: MISSING_VALUE, actual: 2 });
    expect(findFirstDifference([1], [1, 2])).toEqual({ path: '$[1]', expected: MISSING_VALUE, actual: 2 });
    expect(findFirstDifference({ a: undefined }, {})).toEqual({
      path: '$.a',
      expected: undefined,
      actual: MISSING_VALUE,
    });
  });

  it('walks Maps by key and typed arrays by index', () => {
    expect(findFirstDifference(new Map([['k', { v: 1 }]]), new Map([['k', { v: 2 }]]))?.path).toBe('$.get("k").v');
    expect(findFirstDifference(new Float64Array([1, 2]), new Float64Array([1, 2.5]))?.path).toBe('$[1]');
  });

  it('reports a change of shape at the node itself', () => {
    expect(findFirstDifference({ a: [1] }, { a: { 0: 1 } })).toEqual({ path: '$.a', expected: [1], actual: { 0: 1 } });
    expect(findFirstDifference({ a: null }, { a: {} })?.path).toBe('$.a');
  });
});

describe('renderValue', () => {
  it('renders each kind of value on one line', () => {
    expect(renderValue(MISSING_VALUE)).toBe('(missing)');
    expect(renderValue(undefined)).toBe('undefined');
    expect(renderValue(-0)).toBe('-0');
    expect(renderValue(Number.NaN)).toBe('NaN');
    expect(renderValue('p0')).toBe('"p0"');
    expect(renderValue({ owners: new Map([['a', 1n]]) })).toBe('{"owners":{"a":"1n"}}');
  });

  it('cuts a long value to the bound', () => {
    const rendered = renderValue(Array.from({ length: 1000 }, (_value, index) => index));
    expect(rendered).toHaveLength(MAX_RENDERED_VALUE_LENGTH);
    expect(rendered.endsWith('…')).toBe(true);
  });
});
