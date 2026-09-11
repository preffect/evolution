import { describe, expect, it } from 'vitest';
import { indexByTick } from './index-by-tick.js';

describe('indexByTick', () => {
  it('buckets events by tick in order and answers an empty map for no events', () => {
    const events = [
      { tick: 3, name: 'a' },
      { tick: 1, name: 'b' },
      { tick: 3, name: 'c' },
    ];
    const indexed = indexByTick(events);
    expect(indexed.get(3)?.map((event) => event.name)).toEqual(['a', 'c']);
    expect(indexed.get(1)?.map((event) => event.name)).toEqual(['b']);
    expect(indexed.get(2)).toBeUndefined();
    expect(indexByTick([]).size).toBe(0);
  });
});
