// A seat's ladder (docs/ecology/wild-cells.md §3.3): `WILD_CELL_BUILDS[seat mod 3]`, of which a wild cell at level L owns
// the first L − 1 picks; the list wraps as tier upgrades (entry 8 is entry 1 at tier II). Pure: the settle calls it every
// tick and the catalog test pattern pins that each build is a valid ladder.

import { tierOfRowIndex, type BalanceConfig, type OwnedTrait, type TraitTier } from '@evolution/shared';
import { SimulationInvariantError } from '../world/simulation-invariant-error.js';

/** A wild cell at level L owns L − 1 picks. */
const PICKS_BELOW_LEVEL = 1;

/** The tier a `buildLength`-trait build's wrap has reached at `pick` (entry 8 of a 7-trait build is tier II). */
function wrapTierOf(pick: number, buildLength: number): TraitTier {
  return tierOfRowIndex(Math.floor(pick / buildLength));
}

/**
 * Whether a wrap tier is past `TRAIT_TIER_COUNT`: a balance that pairs a short build with a high `MAX_LEVEL`. The one
 * condition the step's invariant and the `debug_set_balance` refusal share (#671).
 */
export function isPastTopTraitTier(tier: number, balance: BalanceConfig): boolean {
  return tier > balance.traits.TRAIT_TIER_COUNT;
}

/** The highest tier any build's wrap reaches at `MAX_LEVEL`: the shortest build's tier at the top level's last pick. */
export function topWildTier(balance: BalanceConfig): number {
  const lastPick = balance.progression.MAX_LEVEL - PICKS_BELOW_LEVEL - 1;
  const shortestBuild = Math.min(...balance.wildCells.WILD_CELL_BUILDS.map((build) => build.length));
  return wrapTierOf(lastPick, shortestBuild);
}

/** The tier the build's wrap has reached at `pick`; a wrap past the top tier is an invariant break, never a tier. */
function tierOfPick(pick: number, buildLength: number, balance: BalanceConfig): TraitTier {
  const tier = wrapTierOf(pick, buildLength);
  if (isPastTopTraitTier(tier, balance)) {
    throw new SimulationInvariantError(
      `wild pick ${pick} of a ${buildLength}-trait build wraps to tier ${tier}, past TRAIT_TIER_COUNT ` +
        `${balance.traits.TRAIT_TIER_COUNT}: MAX_LEVEL ${balance.progression.MAX_LEVEL} needs a longer build`,
    );
  }
  return tier;
}

/** The build's picks up to `level`, in build order, each trait at the highest tier the wrap reached. */
export function wildOwnedTraits(seatNumber: number, level: number, balance: BalanceConfig): OwnedTrait[] {
  const builds = balance.wildCells.WILD_CELL_BUILDS;
  const build = builds[seatNumber % builds.length]!;
  const owned: OwnedTrait[] = [];
  for (let pick = 0; pick < level - PICKS_BELOW_LEVEL; pick += 1) {
    const traitId = build[pick % build.length]!;
    const tier = tierOfPick(pick, build.length, balance);
    const already = owned.find((trait) => trait.traitId === traitId);
    if (already === undefined) {
      owned.push({ traitId, tier });
    } else {
      already.tier = tier;
    }
  }
  return owned;
}
