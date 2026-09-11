// The modifier fold (docs/TRAITS.md §2): the cell's effective modifiers over its owned traits at
// their tiers. Multipliers multiply, bonuses and deltas add, floors and scalars take the max;
// the defaults are the identity. Shared so the HUD's trait preview folds the same way the server
// does (docs/UI.md §3); no system ever switches on a trait id.

import { DEFAULT_CELL_MODIFIERS } from '../constants/trait-modifiers.js';
import type { OwnedTrait, TraitId } from '../types/game.js';
import type { CellModifiers, TraitTiers } from '../types/traits.js';

export const MODIFIER_FOLD = { multiply: 'multiply', add: 'add', max: 'max' } as const;
export type ModifierFold = (typeof MODIFIER_FOLD)[keyof typeof MODIFIER_FOLD];

interface FoldRule {
  readonly fold: ModifierFold;
  /** An additive share that saturates ("adds, cap 1"). */
  readonly cap?: number;
}

const FULL_SHARE = 1;

/** How each modifier folds; pinned complete against `CellModifiers` by the type of the record. */
export const MODIFIER_FOLD_RULES: Readonly<Record<keyof CellModifiers, FoldRule>> = {
  speedMultiplier: { fold: MODIFIER_FOLD.multiply },
  accelerationSecondsMultiplier: { fold: MODIFIER_FOLD.multiply },
  sprintSpeedMultiplierBonus: { fold: MODIFIER_FOLD.add },
  sprintCooldownSecondsDelta: { fold: MODIFIER_FOLD.add },
  membraneRatioBonus: { fold: MODIFIER_FOLD.add },
  engulfDurationMultiplierAsPrey: { fold: MODIFIER_FOLD.multiply },
  engulfDurationMultiplierAsPredator: { fold: MODIFIER_FOLD.multiply },
  engulfMassYieldBonus: { fold: MODIFIER_FOLD.add },
  digestionFactorBonus: { fold: MODIFIER_FOLD.add },
  decayMultiplier: { fold: MODIFIER_FOLD.multiply },
  photosynthesisMassPerSecond: { fold: MODIFIER_FOLD.add },
  spikeDrainFractionPerSecond: { fold: MODIFIER_FOLD.add },
  toxinDrainFractionPerSecond: { fold: MODIFIER_FOLD.add },
  toxinAuraRangeInRadii: { fold: MODIFIER_FOLD.max },
  attractRangeInRadii: { fold: MODIFIER_FOLD.max },
  attractSpeed: { fold: MODIFIER_FOLD.max },
  dnaGainMultiplier: { fold: MODIFIER_FOLD.multiply },
  dnaKeptOnDeathFraction: { fold: MODIFIER_FOLD.add, cap: FULL_SHARE },
  gelSpeedFactorFloor: { fold: MODIFIER_FOLD.max },
};

export const MODIFIER_NAMES = Object.keys(MODIFIER_FOLD_RULES) as readonly (keyof CellModifiers)[];

function foldOne(current: number, tierValue: number, rule: FoldRule): number {
  switch (rule.fold) {
    case MODIFIER_FOLD.multiply:
      return current * tierValue;
    case MODIFIER_FOLD.add: {
      const sum = current + tierValue;
      return rule.cap === undefined ? sum : Math.min(rule.cap, sum);
    }
    default:
      return Math.max(current, tierValue);
  }
}

/** The folded record for `ownedTraits`, read from `tierTables` (`balance.traits.TRAIT_TIERS`) only. */
export function foldModifiers(
  ownedTraits: readonly OwnedTrait[],
  tierTables: Readonly<Record<TraitId, TraitTiers>>,
): CellModifiers {
  const folded: CellModifiers = { ...DEFAULT_CELL_MODIFIERS };
  for (const owned of ownedTraits) {
    // A `TraitTier` is 1..3 and every table has three rows; the index is in range by type.
    const tier = tierTables[owned.traitId][owned.tier - 1] ?? {};
    for (const name of MODIFIER_NAMES) {
      const tierValue = tier[name];
      if (tierValue !== undefined) {
        folded[name] = foldOne(folded[name], tierValue, MODIFIER_FOLD_RULES[name]);
      }
    }
  }
  return folded;
}
