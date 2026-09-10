// xoshiro128** (Blackman & Vigna, 2018): the PRNG behind every seeded stream
// (docs/DETERMINISM.md §3). 128 bits of state, period 2^128 − 1, all 32-bit integer
// arithmetic, so the same seed yields the same sequence on every JavaScript engine.
// A 32-bit seed is expanded into the four state words with splitmix32 (the algorithm the
// authors recommend for seeding).

export type XoshiroWords = [number, number, number, number];

const UINT32_BITS = 32;
/** xoshiro128** keeps four 32-bit state words. */
export const XOSHIRO_WORD_COUNT = 4;
const SPLITMIX32_INCREMENT = 0x9e3779b9;
const SPLITMIX32_MULTIPLIER_ONE = 0x21f0aaad;
const SPLITMIX32_MULTIPLIER_TWO = 0x735a2d97;
const SPLITMIX32_SHIFT_ONE = 16;
const SPLITMIX32_SHIFT_TWO = 15;
const STAR_STAR_MULTIPLIER = 5;
const STAR_STAR_ROTATION = 7;
const STAR_STAR_SCALE = 9;
const STATE_SHIFT = 9;
const STATE_ROTATION = 11;

function rotateLeft(value: number, bits: number): number {
  return ((value << bits) | (value >>> (UINT32_BITS - bits))) >>> 0;
}

function splitmix32Step(state: number): { nextState: number; output: number } {
  const nextState = (state + SPLITMIX32_INCREMENT) >>> 0;
  let mixed = nextState;
  mixed = Math.imul(mixed ^ (mixed >>> SPLITMIX32_SHIFT_ONE), SPLITMIX32_MULTIPLIER_ONE);
  mixed = Math.imul(mixed ^ (mixed >>> SPLITMIX32_SHIFT_TWO), SPLITMIX32_MULTIPLIER_TWO);
  return { nextState, output: (mixed ^ (mixed >>> SPLITMIX32_SHIFT_TWO)) >>> 0 };
}

/**
 * Expands an unsigned 32-bit seed into the four xoshiro state words. The mix function is a
 * bijection, so at most one of four consecutive splitmix outputs can be zero and the all-zero
 * state (the one state xoshiro cannot leave) is unreachable.
 */
export function expandSeedToWords(seed: number): XoshiroWords {
  let state = seed >>> 0;
  const words: number[] = [];
  while (words.length < XOSHIRO_WORD_COUNT) {
    const step = splitmix32Step(state);
    state = step.nextState;
    words.push(step.output);
  }
  return words as XoshiroWords;
}

/** Advances the state in place and returns the next unsigned 32-bit output. */
export function nextUint32(words: XoshiroWords): number {
  const [word0, word1, word2, word3] = words;
  const output = Math.imul(rotateLeft(Math.imul(word1, STAR_STAR_MULTIPLIER), STAR_STAR_ROTATION), STAR_STAR_SCALE);
  const shifted = word1 << STATE_SHIFT;
  const mixed2 = word2 ^ word0;
  const mixed3 = word3 ^ word1;
  words[1] = (word1 ^ mixed2) >>> 0;
  words[0] = (word0 ^ mixed3) >>> 0;
  words[2] = (mixed2 ^ shifted) >>> 0;
  words[3] = rotateLeft(mixed3, STATE_ROTATION);
  return output >>> 0;
}
