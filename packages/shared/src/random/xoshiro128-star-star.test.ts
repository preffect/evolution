import { describe, expect, it } from 'vitest';
import { expandSeedToWords, nextUint32, type XoshiroWords } from './xoshiro128-star-star.js';

// Known answers: the reference xoshiro128** sequence from state {1, 2, 3, 4} and the
// splitmix32 expansions, both computed with an independent Python implementation
// (unsigned big-integer arithmetic) and checked by hand for the first three outputs.
const REFERENCE_WORDS: XoshiroWords = [1, 2, 3, 4];
const REFERENCE_OUTPUTS = [11520, 0, 5927040, 70819200, 2031721883, 1637235492];
const SEED_ZERO_WORDS: XoshiroWords = [1684164658, 3653269916, 2939563536, 2141751570];
const SEED_ZERO_OUTPUTS = [1789933344, 44971166, 2521387044, 3848737593];
const SEED_42 = 42;
const SEED_42_WORDS: XoshiroWords = [551831576, 144025891, 322543647, 3034809370];
const SEED_42_OUTPUTS = [660444221, 3652823732, 77672526, 910233633];
const MANY_DRAWS = 1000;

function isUint32(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}

function drawMany(words: XoshiroWords, count: number): number[] {
  return Array.from({ length: count }, () => nextUint32(words));
}

describe('xoshiro128**', () => {
  it('reproduces the reference sequence from state {1, 2, 3, 4}', () => {
    expect(drawMany([...REFERENCE_WORDS], REFERENCE_OUTPUTS.length)).toEqual(REFERENCE_OUTPUTS);
  });

  it('expands seed 0 with splitmix32 to the reference words and outputs', () => {
    const words = expandSeedToWords(0);
    expect(words).toEqual(SEED_ZERO_WORDS);
    expect(drawMany(words, SEED_ZERO_OUTPUTS.length)).toEqual(SEED_ZERO_OUTPUTS);
  });

  it('expands seed 42 with splitmix32 to the reference words and outputs', () => {
    const words = expandSeedToWords(SEED_42);
    expect(words).toEqual(SEED_42_WORDS);
    expect(drawMany(words, SEED_42_OUTPUTS.length)).toEqual(SEED_42_OUTPUTS);
  });

  it('keeps every state word and output an unsigned 32-bit integer', () => {
    const words = expandSeedToWords(0xffffffff);
    const outputs = drawMany(words, MANY_DRAWS);
    const offenders = [...words, ...outputs].filter((value) => !isUint32(value));
    expect(offenders).toEqual([]);
  });

  it('reduces the seed modulo 2^32 before expanding', () => {
    expect(expandSeedToWords(0x1_0000_0000 + SEED_42)).toEqual(SEED_42_WORDS);
  });
});
