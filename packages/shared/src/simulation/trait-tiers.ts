// The tier model's indexing rule (docs/traits/model.md §1): tiers are numbered from I, a tier table is a tuple read
// from index 0. One home for the conversion, so no caller writes `tier - 1` itself.

import type { TraitTier } from '../types/game.js';
import type { TraitTierModifiers, TraitTiers } from '../types/traits.js';

/** The tier a trait is first owned at. */
export const FIRST_TIER: TraitTier = 1;

/** The row of `tiers` for `tier` (1-based); `undefined` past the table. */
export function tierRowOf(tiers: TraitTiers, tier: number): TraitTierModifiers | undefined {
  return tiers[tier - FIRST_TIER];
}

/** The tier a row index (0-based) of a tier table stands for. */
export function tierOfRowIndex(rowIndex: number): TraitTier {
  return (rowIndex + FIRST_TIER) as TraitTier;
}
