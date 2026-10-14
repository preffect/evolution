// Membership guards for the id objects of game.ts (docs/CODE-STANDARDS.md §3): the one home of
// "is this value a food kind / bacterium variant / DNA tag / giant species / stage", used wherever an untyped id enters
// the simulation (a debug request, a balance patch, a scenario fixture). A guard only answers; the caller wraps
// the refusal in its own error type.

import {
  BACTERIUM_VARIANT,
  CELL_STAGE,
  DNA_TAG,
  FOOD_KIND,
  GIANT_SPECIES,
  type BacteriumVariant,
  type CellStage,
  type DnaTag,
  type FoodKind,
  type GiantSpecies,
} from './game.js';

const FOOD_KINDS: ReadonlySet<unknown> = new Set(Object.values(FOOD_KIND));
const BACTERIUM_VARIANT_NAMES: ReadonlySet<unknown> = new Set(Object.values(BACTERIUM_VARIANT));
const DNA_TAG_NAMES: ReadonlySet<unknown> = new Set(Object.values(DNA_TAG));
const GIANT_SPECIES_NAMES: ReadonlySet<unknown> = new Set(Object.values(GIANT_SPECIES));
const CELL_STAGE_NAMES: ReadonlySet<unknown> = new Set(Object.values(CELL_STAGE));

export function isFoodKind(value: unknown): value is FoodKind {
  return FOOD_KINDS.has(value);
}

export function isBacteriumVariant(value: unknown): value is BacteriumVariant {
  return BACTERIUM_VARIANT_NAMES.has(value);
}

export function isDnaTag(value: unknown): value is DnaTag {
  return DNA_TAG_NAMES.has(value);
}

export function isGiantSpecies(value: unknown): value is GiantSpecies {
  return GIANT_SPECIES_NAMES.has(value);
}

/** A stage of the ladder: every `CELL_STAGE` value, which is every member of `STAGE_ORDER` (ladder.test.ts). */
export function isCellStage(value: unknown): value is CellStage {
  return CELL_STAGE_NAMES.has(value);
}
