// DNA, levels, drafts and late join (docs/PROGRESSION.md §6). The level cost formula has one
// home: simulation/level-costs.ts.

import { DNA_TAG, type DnaTag } from '../types/game.js';
import { TRAIT_RARITY, type TraitRarity } from '../types/traits.js';

export const MAX_LEVEL = 12;
/** levelUpCost(level) = LEVEL_UP_COST_BASE_DNA + LEVEL_UP_COST_PER_LEVEL_DNA × level. */
export const LEVEL_UP_COST_BASE_DNA = 10;
export const LEVEL_UP_COST_PER_LEVEL_DNA = 10;
/** Cards per draft. */
export const TRAIT_DRAFT_SIZE = 3;
/** Draft weight by rarity (docs/PROGRESSION.md §3). */
export const RARITY_WEIGHT: Record<TraitRarity, number> = {
  [TRAIT_RARITY.common]: 1.0,
  [TRAIT_RARITY.uncommon]: 0.5,
  [TRAIT_RARITY.rare]: 0.2,
};
/** weight × min(TAG_WEIGHT_MAX_MULTIPLIER, 1 + TAG_WEIGHT_PER_POINT × tagScore). */
export const TAG_WEIGHT_PER_POINT = 0.1;
export const TAG_WEIGHT_MAX_MULTIPLIER = 4;
/** An upgrade card of an owned trait weighs this much more. */
export const UPGRADE_CARD_WEIGHT_MULTIPLIER = 1.5;
/** An offer auto-picks this long after it is shown (s). */
export const TRAIT_CHOICE_TIMEOUT_SECONDS = 10;
/** Reserved: no rerolls in build 1. */
export const TRAIT_REROLLS_PER_ROUND = 0;
/** Mass granted instead of a draft when no candidate exists. */
export const LEVEL_UP_NO_DRAFT_MASS_BONUS = 10;
/** Late join (docs/PROGRESSION.md §5): joining after the grace gets a share of the living medians. */
export const LATE_JOIN_GRACE_SECONDS = 30;
export const LATE_JOIN_DNA_FRACTION = 0.5;
export const LATE_JOIN_MASS_FRACTION = 0.25;
export const LATE_JOIN_MAX_MASS = 200;

/** The seven tags in walk order: records keyed by tag are hashed in this order (docs/DETERMINISM.md §5). */
export const DNA_TAGS = [
  DNA_TAG.motile,
  DNA_TAG.photic,
  DNA_TAG.predatory,
  DNA_TAG.armored,
  DNA_TAG.toxic,
  DNA_TAG.sensory,
  DNA_TAG.metabolic,
] as const satisfies readonly DnaTag[];
