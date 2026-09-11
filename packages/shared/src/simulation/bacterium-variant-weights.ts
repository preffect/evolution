// The variant row a bacterium cluster draws from (docs/ECOLOGY.md §3.2): the vent and shallows
// rows are fixed (a trip is always a trip); the broth and gel row follows the world stage, so
// organelles spread through the world as it ages.

import type { BalanceConfig } from '../constants/balance.js';
import type { TripZoneId } from '../constants/ecology.js';
import { ZONE_ID, type BacteriumVariant, type CellStage, type ZoneId } from '../types/game.js';

/** The fixed trip rows and the broth share by stage, taken from `balance.ecology`. */
export type VariantWeightsBalance = Pick<
  BalanceConfig['ecology'],
  'BACTERIUM_VARIANT_WEIGHTS_BY_ZONE' | 'BROTH_VARIANT_SHARE_BY_WORLD_STAGE'
>;

/** The two organelle variants split the broth share evenly. */
const ORGANELLE_VARIANT_COUNT = 2;

function isTripZone(zone: ZoneId): zone is TripZoneId {
  return zone === ZONE_ID.warmVent || zone === ZONE_ID.sunlitShallows;
}

/** plain = 1 − share, aerobic = photosynthetic = share / 2. */
export function brothVariantWeights(share: number): Record<BacteriumVariant, number> {
  const organelleShare = share / ORGANELLE_VARIANT_COUNT;
  return { plain: 1 - share, aerobic: organelleShare, photosynthetic: organelleShare };
}

export function bacteriumVariantWeightsForZone(
  zone: ZoneId,
  worldStage: CellStage,
  balance: VariantWeightsBalance,
): Record<BacteriumVariant, number> {
  if (isTripZone(zone)) return balance.BACTERIUM_VARIANT_WEIGHTS_BY_ZONE[zone];
  return brothVariantWeights(balance.BROTH_VARIANT_SHARE_BY_WORLD_STAGE[worldStage]);
}
