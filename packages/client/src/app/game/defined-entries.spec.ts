// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { definedEntriesOf } from './defined-entries';

describe('definedEntriesOf', () => {
  it('drops the keys whose value is undefined, rather than keeping them set to undefined', () => {
    const result = definedEntriesOf({ kept: 1, dropped: undefined });
    expect(Object.keys(result)).toEqual(['kept']);
    expect('dropped' in result).toBe(false);
  });

  it('passes every other falsy value through, so a handler is never mistaken for an absent one', () => {
    expect(definedEntriesOf({ zero: 0, empty: '', no: false, nothing: null })).toEqual({
      zero: 0,
      empty: '',
      no: false,
      nothing: null,
    });
  });

  it('keeps functions by reference, which is what the seams forward', () => {
    const handler = (): void => undefined;
    expect(definedEntriesOf({ handler }).handler).toBe(handler);
  });

  it('answers an empty record for one with nothing defined', () => {
    expect(definedEntriesOf({ a: undefined, b: undefined })).toEqual({});
  });
});
