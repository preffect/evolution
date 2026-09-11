// docs/DETERMINISM.md §3: one weighted draw over a list, the index from the seeded source.
import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '@evolution/shared';
import { SimulationInvariantError } from '../world/simulation-invariant-error.js';
import { pickWeighted } from './pick-weighted.js';

const SEED = 7;
const DRAWS = 300;
const ITEMS = ['heavy', 'light', 'never'] as const;
type Item = (typeof ITEMS)[number];
const WEIGHTS: Record<Item, number> = { heavy: 3, light: 1, never: 0 };
const weightOf = (item: Item): number => WEIGHTS[item];

describe('pickWeighted', () => {
  it('draws the item at the weighted index of the same seeded stream', () => {
    const picking = createSeededRandom(SEED);
    const indexing = createSeededRandom(SEED);
    const weights = ITEMS.map(weightOf);
    for (let draw = 0; draw < DRAWS; draw += 1) {
      expect(pickWeighted(picking, ITEMS, weightOf)).toBe(ITEMS[indexing.weightedIndex(weights)]);
    }
  });

  it('never draws a zero-weight item and favours the heavier one', () => {
    const random = createSeededRandom(SEED);
    const counts: Record<Item, number> = { heavy: 0, light: 0, never: 0 };
    for (let draw = 0; draw < DRAWS; draw += 1) {
      counts[pickWeighted(random, ITEMS, weightOf)] += 1;
    }
    expect(counts.never).toBe(0);
    expect(counts.heavy).toBeGreaterThan(counts.light);
    expect(counts.heavy + counts.light).toBe(DRAWS);
  });

  it('is deterministic per seed and differs across seeds', () => {
    const sequence = (seed: number): Item[] => {
      const random = createSeededRandom(seed);
      return Array.from({ length: DRAWS }, () => pickWeighted(random, ITEMS, weightOf));
    };
    expect(sequence(SEED)).toEqual(sequence(SEED));
    expect(sequence(SEED)).not.toEqual(sequence(SEED + 1));
  });

  it('throws a SimulationInvariantError on an empty list before touching the stream', () => {
    const random = createSeededRandom(SEED);
    const before = random.getState();
    expect(() => pickWeighted(random, [], () => 1)).toThrow(SimulationInvariantError);
    expect(random.getState()).toEqual(before);
  });
});
