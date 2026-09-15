// The game's core quantities, the pages prose links "mass" and "DNA" to (docs/architecture/encyclopedia.md §12.4;
// #361 writes them). Every concept sits under basics but `food`, the food overview, which `CATEGORY_BY_ENTRY` sends
// to entities.

import type { ValueOf } from '@evolution/shared';

export const CONCEPT = {
  massAndSize: 'mass_and_size',
  massDecay: 'mass_decay',
  engulfRatio: 'engulf_ratio',
  dnaAndLevels: 'dna_and_levels',
  score: 'score',
  worldStanding: 'world_standing',
  /** The overview of every food kind. */
  food: 'food',
} as const;
export type ConceptId = ValueOf<typeof CONCEPT>;
