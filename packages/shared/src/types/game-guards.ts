// Membership guards for the id objects of game.ts (docs/CODE-STANDARDS.md §3): the one home of
// "is this value a food kind / bacterium variant / DNA tag", used wherever an untyped id enters
// the simulation (a debug request, a scenario fixture). A guard only answers; the caller wraps
// the refusal in its own error type.

import { BACTERIUM_VARIANT, DNA_TAG, FOOD_KIND, type BacteriumVariant, type DnaTag, type FoodKind } from './game.js';

const FOOD_KINDS: ReadonlySet<unknown> = new Set(Object.values(FOOD_KIND));
const BACTERIUM_VARIANT_NAMES: ReadonlySet<unknown> = new Set(Object.values(BACTERIUM_VARIANT));
const DNA_TAG_NAMES: ReadonlySet<unknown> = new Set(Object.values(DNA_TAG));

export function isFoodKind(value: unknown): value is FoodKind {
  return FOOD_KINDS.has(value);
}

export function isBacteriumVariant(value: unknown): value is BacteriumVariant {
  return BACTERIUM_VARIANT_NAMES.has(value);
}

export function isDnaTag(value: unknown): value is DnaTag {
  return DNA_TAG_NAMES.has(value);
}
