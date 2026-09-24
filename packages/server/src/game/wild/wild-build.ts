// A seat's ladder (docs/ecology/wild-cells.md §3.3): `WILD_CELL_BUILDS[seat mod 3]`, of which a wild cell at level L owns
// the first L − 1 picks; the list wraps as tier upgrades (entry 8 is entry 1 at tier II). Pure: the settle calls it every
// tick and the catalog test pattern pins that each build is a valid ladder.

import { tierOfRowIndex, type BalanceConfig, type OwnedTrait } from '@evolution/shared';

/** A wild cell at level L owns L − 1 picks. */
const PICKS_BELOW_LEVEL = 1;

/** The build's picks up to `level`, in build order, each trait at the highest tier the wrap reached. */
export function wildOwnedTraits(seatNumber: number, level: number, balance: BalanceConfig): OwnedTrait[] {
  const builds = balance.wildCells.WILD_CELL_BUILDS;
  const build = builds[seatNumber % builds.length]!;
  const owned: OwnedTrait[] = [];
  for (let pick = 0; pick < level - PICKS_BELOW_LEVEL; pick += 1) {
    const traitId = build[pick % build.length]!;
    const tier = tierOfRowIndex(Math.floor(pick / build.length));
    const already = owned.find((trait) => trait.traitId === traitId);
    if (already === undefined) {
      owned.push({ traitId, tier });
    } else {
      already.tier = tier;
    }
  }
  return owned;
}
