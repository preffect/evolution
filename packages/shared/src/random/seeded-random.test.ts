import { describe, expect, it } from 'vitest';
import { hashLabel } from './label-hash.js';
import { RANDOM_STREAM } from './stream-labels.js';
import type { RandomState } from './random-source.js';
import { createSeededRandom, createSeededRandomFromState, SeededRandomError } from './seeded-random.js';

const TEST_SEED = 42;
const OTHER_SEED = 43;
const SAMPLE_COUNT = 1000;
const LARGE_SAMPLE_COUNT = 20_000;
const GAUSSIAN_TOLERANCE = 0.05;
const DIE_MIN = 1;
const DIE_MAX = 6;
const MEAN_TOLERANCE_RATIO = 0.03;
/** 2^32: one past the largest unsigned 32-bit word. */
const UINT32_RANGE = 0x1_0000_0000;

function drawFloats(seed: number, count: number): number[] {
  const random = createSeededRandom(seed);
  return Array.from({ length: count }, () => random.nextFloat());
}

describe('createSeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    expect(drawFloats(TEST_SEED, SAMPLE_COUNT)).toEqual(drawFloats(TEST_SEED, SAMPLE_COUNT));
  });

  it('produces a different sequence for a different seed', () => {
    expect(drawFloats(TEST_SEED, SAMPLE_COUNT)).not.toEqual(drawFloats(OTHER_SEED, SAMPLE_COUNT));
  });

  it('rejects seeds that are not non-negative safe integers', () => {
    for (const badSeed of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 2]) {
      expect(() => createSeededRandom(badSeed)).toThrow(SeededRandomError);
    }
  });

  it('starts at position zero with the seed recorded', () => {
    expect(createSeededRandom(TEST_SEED).getState()).toMatchObject({ seed: TEST_SEED, position: 0 });
  });
});

describe('nextFloat / nextInt', () => {
  it('keeps floats in [0, 1)', () => {
    const outOfRange = drawFloats(TEST_SEED, LARGE_SAMPLE_COUNT).filter((value) => value < 0 || value >= 1);
    expect(outOfRange).toEqual([]);
  });

  it('keeps integers inside the inclusive bounds and reaches both ends', () => {
    const random = createSeededRandom(TEST_SEED);
    const values = Array.from({ length: LARGE_SAMPLE_COUNT }, () => random.nextInt(DIE_MIN, DIE_MAX));
    expect(values.filter((value) => !Number.isInteger(value))).toEqual([]);
    expect([...new Set(values)].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('returns the only value of a degenerate range without drawing wrongly', () => {
    expect(createSeededRandom(TEST_SEED).nextInt(DIE_MAX, DIE_MAX)).toBe(DIE_MAX);
  });

  it('rejects non-integer or inverted bounds', () => {
    const random = createSeededRandom(TEST_SEED);
    expect(() => random.nextInt(DIE_MAX, DIE_MIN)).toThrow(SeededRandomError);
    expect(() => random.nextInt(0.5, DIE_MAX)).toThrow(SeededRandomError);
    expect(() => random.nextInt(DIE_MIN, Number.NaN)).toThrow(SeededRandomError);
  });
});

describe('nextGaussian', () => {
  it('has roughly zero mean and unit variance and consumes two draws per call', () => {
    const random = createSeededRandom(TEST_SEED);
    let sum = 0;
    let sumOfSquares = 0;
    for (let index = 0; index < LARGE_SAMPLE_COUNT; index += 1) {
      const value = random.nextGaussian();
      sum += value;
      sumOfSquares += value * value;
    }
    expect(sum / LARGE_SAMPLE_COUNT).toBeCloseTo(0, 1);
    expect(Math.abs(sumOfSquares / LARGE_SAMPLE_COUNT - 1)).toBeLessThan(GAUSSIAN_TOLERANCE);
    expect(random.getState().position).toBe(2 * LARGE_SAMPLE_COUNT);
  });
});

describe('pick / weightedIndex / shuffle', () => {
  it('picks every item eventually and only items from the list', () => {
    const random = createSeededRandom(TEST_SEED);
    const items = ['a', 'b', 'c'] as const;
    const picked = new Set(Array.from({ length: SAMPLE_COUNT }, () => random.pick(items)));
    expect([...picked].sort()).toEqual([...items]);
  });

  it('throws when picking from an empty list', () => {
    expect(() => createSeededRandom(TEST_SEED).pick([])).toThrow(SeededRandomError);
  });

  it('draws weighted indices in proportion to their weights and never a zero weight', () => {
    const random = createSeededRandom(TEST_SEED);
    const weights = [1, 0, 3];
    const counts = [0, 0, 0];
    for (let index = 0; index < LARGE_SAMPLE_COUNT; index += 1) {
      const drawn = random.weightedIndex(weights);
      counts[drawn] = (counts[drawn] ?? 0) + 1;
    }
    expect(counts[1]).toBe(0);
    const expectedLast = (LARGE_SAMPLE_COUNT * 3) / 4;
    expect(Math.abs((counts[2] as number) - expectedLast)).toBeLessThan(expectedLast * MEAN_TOLERANCE_RATIO);
  });

  it('returns the last index when it carries all the weight', () => {
    expect(createSeededRandom(TEST_SEED).weightedIndex([0, 0, 1])).toBe(2);
  });

  it('rejects empty, all-zero, negative and NaN weight tables', () => {
    const random = createSeededRandom(TEST_SEED);
    expect(() => random.weightedIndex([])).toThrow(SeededRandomError);
    expect(() => random.weightedIndex([0, 0])).toThrow(SeededRandomError);
    expect(() => random.weightedIndex([1, -1])).toThrow(SeededRandomError);
    expect(() => random.weightedIndex([1, Number.NaN])).toThrow(SeededRandomError);
  });

  it('shuffles into a new permutation and leaves the input untouched', () => {
    const random = createSeededRandom(TEST_SEED);
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = random.shuffle(items);
    expect(shuffled).not.toBe(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...shuffled].sort((left, right) => left - right)).toEqual(items);
    expect(shuffled).not.toEqual(items);
  });

  it('shuffles identically for the same seed', () => {
    const items = ['w', 'x', 'y', 'z'];
    expect(createSeededRandom(TEST_SEED).shuffle(items)).toEqual(createSeededRandom(TEST_SEED).shuffle(items));
  });
});

describe('fork', () => {
  it('gives the same child for the same label from the same parent', () => {
    const left = createSeededRandom(TEST_SEED).fork(RANDOM_STREAM.spawner);
    const right = createSeededRandom(TEST_SEED).fork(RANDOM_STREAM.spawner);
    expect(left.getState()).toEqual(right.getState());
  });

  it('gives independent children for different labels', () => {
    const parent = createSeededRandom(TEST_SEED);
    const spawner = parent.fork(RANDOM_STREAM.spawner);
    const draft = parent.fork(RANDOM_STREAM.traitDraft);
    expect(spawner.getState().seed).not.toBe(draft.getState().seed);
    expect(spawner.nextFloat()).not.toBe(draft.nextFloat());
  });

  it('does not depend on how many draws the parent or a sibling consumed', () => {
    const untouched = createSeededRandom(TEST_SEED).fork(RANDOM_STREAM.traitDraft);
    const busyParent = createSeededRandom(TEST_SEED);
    busyParent.nextFloat();
    busyParent.fork(RANDOM_STREAM.spawner).nextFloat();
    const afterDraws = busyParent.fork(RANDOM_STREAM.traitDraft);
    expect(drawFrom(afterDraws)).toEqual(drawFrom(untouched));
  });

  it('seeds the child from hashLabel(parentSeed, label)', () => {
    const child = createSeededRandom(TEST_SEED).fork(RANDOM_STREAM.zones);
    expect(child.getState().seed).toBe(hashLabel(TEST_SEED, RANDOM_STREAM.zones));
  });
});

describe('createSeededRandomFromState', () => {
  it('continues exactly where the original left off', () => {
    const original = createSeededRandom(TEST_SEED);
    drawFrom(original);
    const resumed = createSeededRandomFromState(original.getState());
    expect(drawFrom(resumed)).toEqual(drawFrom(original));
    expect(resumed.getState()).toEqual(original.getState());
  });

  it('snapshots the state so later draws do not mutate an exported copy', () => {
    const random = createSeededRandom(TEST_SEED);
    const before = random.getState();
    random.nextFloat();
    expect(random.getState()).not.toEqual(before);
    expect(createSeededRandomFromState(before).getState()).toEqual(before);
  });

  it('rejects words that are not four unsigned 32-bit integers or are all zero', () => {
    const state = createSeededRandom(TEST_SEED).getState();
    const corruptWords: unknown[] = [
      [1, 2, 3],
      [1, 2, 3, 4, 5],
      [1.5, 2, 3, 4],
      [Number.NaN, 2, 3, 4],
      [-1, 2, 3, 4],
      [UINT32_RANGE, 2, 3, 4],
      [0, 0, 0, 0],
      'nope',
    ];
    for (const words of corruptWords) {
      expect(() => createSeededRandomFromState({ ...state, words: words as RandomState['words'] })).toThrow(
        SeededRandomError,
      );
    }
  });

  it('rejects a position that is not a non-negative safe integer', () => {
    const state = createSeededRandom(TEST_SEED).getState();
    for (const position of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => createSeededRandomFromState({ ...state, position })).toThrow(SeededRandomError);
    }
  });

  it('rejects a corrupt seed in the state', () => {
    const state = createSeededRandom(TEST_SEED).getState();
    expect(() => createSeededRandomFromState({ ...state, seed: -1 })).toThrow(SeededRandomError);
  });
});

function drawFrom(random: { nextFloat(): number }): number[] {
  return Array.from({ length: SAMPLE_COUNT }, () => random.nextFloat());
}
