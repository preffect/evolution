// Membership guards for the id objects of game.ts and pool.ts (docs/CODE-STANDARDS.md §3): the one home of "is this
// value a food kind / bacterium variant / DNA tag / giant species / pool creature / stage / era list / trait id list",
// used wherever an untyped id enters the simulation (a debug request, a balance patch, a scenario fixture). A guard only
// answers; the caller wraps the refusal in its own error type.

import { TRAIT_CATALOG } from '../constants/traits.js';
import {
  BACTERIUM_VARIANT,
  CELL_STAGE,
  DNA_TAG,
  FOOD_KIND,
  GAME_ERA,
  GAME_ERA_ORDER,
  GIANT_SPECIES,
  type BacteriumVariant,
  type CellStage,
  type DnaTag,
  type FoodKind,
  type GameEra,
  type GiantSpecies,
  type TraitId,
} from './game.js';
import { POOL_CREATURE_SPECIES, type PoolCreatureSpecies } from './pool.js';

const FOOD_KINDS: ReadonlySet<unknown> = new Set(Object.values(FOOD_KIND));
const BACTERIUM_VARIANT_NAMES: ReadonlySet<unknown> = new Set(Object.values(BACTERIUM_VARIANT));
const DNA_TAG_NAMES: ReadonlySet<unknown> = new Set(Object.values(DNA_TAG));
const GIANT_SPECIES_NAMES: ReadonlySet<unknown> = new Set(Object.values(GIANT_SPECIES));
const CELL_STAGE_NAMES: ReadonlySet<unknown> = new Set(Object.values(CELL_STAGE));
const GAME_ERA_NAMES: ReadonlySet<unknown> = new Set(Object.values(GAME_ERA));
const POOL_CREATURE_SPECIES_NAMES: ReadonlySet<unknown> = new Set(Object.values(POOL_CREATURE_SPECIES));
const TRAIT_IDS: ReadonlySet<unknown> = new Set(TRAIT_CATALOG.map((trait) => trait.id));

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

export function isPoolCreatureSpecies(value: unknown): value is PoolCreatureSpecies {
  return POOL_CREATURE_SPECIES_NAMES.has(value);
}

/** A stage of the ladder: every `CELL_STAGE` value, which is every member of `STAGE_ORDER` (ladder.test.ts). */
export function isCellStage(value: unknown): value is CellStage {
  return CELL_STAGE_NAMES.has(value);
}

export function isGameEra(value: unknown): value is GameEra {
  return GAME_ERA_NAMES.has(value);
}

/**
 * An `ERAS_IN_PLAY` list (docs/game-design/phases.md §14.2.4): a non-empty prefix of `GAME_ERA_ORDER`, so a game always
 * has the dish and never skips an era. `['dish']`, `['dish', 'pool']` and the whole order pass; anything else fails, a
 * list past the last era too (its extra entry meets no era of the order).
 */
export function isErasInPlayList(value: unknown): value is readonly GameEra[] {
  return Array.isArray(value) && value.length > 0 && value.every((era, index) => era === GAME_ERA_ORDER[index]);
}

/** A trait id: the id of a catalog row (docs/traits/catalog-organelles.md §3). */
export function isTraitId(value: unknown): value is TraitId {
  return TRAIT_IDS.has(value);
}

/**
 * A list of distinct trait ids, the empty list included: the `SWALLOW_GATE_TRAITS` leaf (docs/game-design/early-life.md
 * §15.10). A non-catalog id, an id twice or a value that is not a list fails.
 */
export function isDistinctTraitIdList(value: unknown): value is readonly TraitId[] {
  return Array.isArray(value) && value.every(isTraitId) && new Set(value).size === value.length;
}
