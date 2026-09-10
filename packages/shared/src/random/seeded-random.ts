// The RandomSource implementation (docs/DETERMINISM.md §3): xoshiro128** behind the helpers
// every subsystem uses, forks by label hash, and exact resume from serialised state.

import { hashLabel } from './label-hash.js';
import type { RandomSource, RandomState } from './random-source.js';
import { expandSeedToWords, nextUint32, XOSHIRO_WORD_COUNT, type XoshiroWords } from './xoshiro128-star-star.js';

/** 2^32: an unsigned 32-bit output divided by this is uniform in [0, 1). */
const UINT32_RANGE = 0x1_0000_0000;
/** Box–Muller: sqrt(-2 ln u) has this factor and the angle spans a full turn. */
const BOX_MULLER_SCALE = -2;
const FULL_TURN_RADIANS = 2 * Math.PI;

export class SeededRandomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeededRandomError';
  }
}

function assertSeed(seed: number): void {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new SeededRandomError(`Seed must be a non-negative safe integer, got ${String(seed)}`);
  }
}

/** The four words must be unsigned 32-bit integers and not all zero: the one state xoshiro cannot leave. */
function assertWords(words: unknown): asserts words is XoshiroWords {
  const isWordList =
    Array.isArray(words) && words.length === XOSHIRO_WORD_COUNT && words.every((word) => word === word >>> 0);
  if (!isWordList) {
    throw new SeededRandomError(
      `State words must be ${XOSHIRO_WORD_COUNT} unsigned 32-bit integers, got ${String(words)}`,
    );
  }
  if (words.every((word) => word === 0)) {
    throw new SeededRandomError('State words must not all be zero');
  }
}

function assertPosition(position: number): void {
  if (!Number.isSafeInteger(position) || position < 0) {
    throw new SeededRandomError(`State position must be a non-negative safe integer, got ${String(position)}`);
  }
}

function assertIntegerRange(minInclusive: number, maxInclusive: number): void {
  if (!Number.isSafeInteger(minInclusive) || !Number.isSafeInteger(maxInclusive) || maxInclusive < minInclusive) {
    throw new SeededRandomError(`nextInt needs integer bounds with min <= max, got [${minInclusive}, ${maxInclusive}]`);
  }
}

function sumOfWeights(weights: readonly number[]): number {
  let total = 0;
  for (const weight of weights) {
    if (!(weight >= 0)) {
      throw new SeededRandomError(`weightedIndex needs non-negative weights, got ${String(weight)}`);
    }
    total += weight;
  }
  if (total <= 0) {
    throw new SeededRandomError('weightedIndex needs at least one positive weight');
  }
  return total;
}

class SeededRandom implements RandomSource {
  private position: number;
  private readonly words: XoshiroWords;

  constructor(
    private readonly seed: number,
    words: Readonly<XoshiroWords>,
    position: number,
  ) {
    // The one copy in: `getState()` copies out, so no caller shares the live words.
    this.words = [...words];
    this.position = position;
  }

  nextFloat(): number {
    this.position += 1;
    return nextUint32(this.words) / UINT32_RANGE;
  }

  nextInt(minInclusive: number, maxInclusive: number): number {
    assertIntegerRange(minInclusive, maxInclusive);
    const span = maxInclusive - minInclusive + 1;
    return minInclusive + Math.floor(this.nextFloat() * span);
  }

  nextGaussian(): number {
    // 1 − u keeps the argument of the logarithm in (0, 1], so it never hits ln(0).
    const radius = Math.sqrt(BOX_MULLER_SCALE * Math.log(1 - this.nextFloat()));
    const angleRadians = FULL_TURN_RADIANS * this.nextFloat();
    return radius * Math.cos(angleRadians);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new SeededRandomError('pick needs a non-empty list');
    }
    return items[this.nextInt(0, items.length - 1)] as T;
  }

  weightedIndex(weights: readonly number[]): number {
    const total = sumOfWeights(weights);
    const draw = this.nextFloat() * total;
    let cumulative = 0;
    // The sum runs in the same left-to-right order as `total`, and `draw < total`, so the
    // draw always lands before the final weight is reached.
    for (let index = 0; index < weights.length - 1; index += 1) {
      cumulative += weights[index] as number;
      if (draw < cumulative) {
        return index;
      }
    }
    return weights.length - 1;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = this.nextInt(0, index);
      const swapped = shuffled[swapIndex] as T;
      shuffled[swapIndex] = shuffled[index] as T;
      shuffled[index] = swapped;
    }
    return shuffled;
  }

  fork(label: string): RandomSource {
    return createSeededRandom(hashLabel(this.seed, label));
  }

  getState(): RandomState {
    return { seed: this.seed, position: this.position, words: [...this.words] };
  }
}

/**
 * A fresh stream from a non-negative integer seed. Seeds are reduced modulo 2^32 (the
 * xoshiro seed width); the config boundary validates against `SEED_MAX`, and the rematch
 * increment past it wraps rather than throws.
 */
export function createSeededRandom(seed: number): RandomSource {
  assertSeed(seed);
  const reducedSeed = seed >>> 0;
  return new SeededRandom(reducedSeed, expandSeedToWords(reducedSeed), 0);
}

/** Resumes exactly where `getState()` left off: the next draw equals what the original would have drawn. */
export function createSeededRandomFromState(state: RandomState): RandomSource {
  assertSeed(state.seed);
  assertWords(state.words);
  assertPosition(state.position);
  return new SeededRandom(state.seed, state.words, state.position);
}
