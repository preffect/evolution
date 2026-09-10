// The seeded random contract every subsystem draws from (docs/DETERMINISM.md §3).
// Implementations: seeded-random.ts (xoshiro128**). Nothing in game code calls Math.random.

/**
 * Serialisable stream state. `words` are the four xoshiro128** state words, so a stream
 * resumes in O(1) after any number of draws; `seed` is what `fork` derives children from and
 * `position` counts the draws consumed since seeding (diagnostics and the state hash).
 */
export interface RandomState {
  readonly seed: number;
  readonly position: number;
  readonly words: readonly [number, number, number, number];
}

export interface RandomSource {
  /** Uniform in [0, 1). */
  nextFloat(): number;
  /** Uniform integer in [minInclusive, maxInclusive]; both bounds must be integers. */
  nextInt(minInclusive: number, maxInclusive: number): number;
  /** Standard normal deviate (mean 0, standard deviation 1); consumes two draws. */
  nextGaussian(): number;
  /** One item, uniformly; throws on an empty list. */
  pick<T>(items: readonly T[]): T;
  /** An index drawn proportionally to `weights` (ECOLOGY tables, draft weights). */
  weightedIndex(weights: readonly number[]): number;
  /** A new array with the items in a uniformly random order; the input is untouched. */
  shuffle<T>(items: readonly T[]): T[];
  /** An independent child stream seeded from `hashLabel(seed, label)`, never from this sequence. */
  fork(label: string): RandomSource;
  /** The serialisable state; `createSeededRandomFromState` continues exactly from it. */
  getState(): RandomState;
}
