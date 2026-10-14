// A giant's ladder (docs/ecology/giants.md §3.5.4, §3.5.5): its species' fixed build (`GIANT_BUILDS_BY_SPECIES`),
// owned at those tiers for its whole life, its level derived from the build (each tier is a pick and a cell at level L
// owns L − 1 picks, as `wild-build.ts` counts them), and its species' speed multiplier on the folded traits' speed.
// `applyGiantBuild` is the one home of that multiplier: every refresh of a giant's derived state goes through it, so a
// refresh that skipped it cannot silently drop the multiplier (§3.5.15). Pure over the cell and the balance.

import { giantBuildOf, type BalanceConfig, type GiantSpecies, type OwnedTrait } from '@evolution/shared';
import { refreshCellDerivedStateFromTraits } from '../progression/modifiers.js';
import type { CellRecord } from '../world/entities.js';

/** A cell at level L owns L − 1 picks. */
const PICKS_BELOW_LEVEL = 1;

/** Picks + 1: every tier of every trait is one pick (Amoeba Pseudopods II is two). No constant names it. */
export function giantLevelOf(build: readonly OwnedTrait[]): number {
  return build.reduce((picks, trait) => picks + trait.tier, 0) + PICKS_BELOW_LEVEL;
}

/** Level, traits, stage and modifiers from the species' build, then × the species' speed multiplier. */
export function applyGiantBuild(cell: CellRecord, species: GiantSpecies, balance: BalanceConfig): void {
  const build = giantBuildOf(species, balance);
  cell.level = giantLevelOf(build);
  refreshCellDerivedStateFromTraits(cell, build, balance);
  cell.modifiers.speedMultiplier *= balance.giants.GIANT_SPEED_MULTIPLIER_BY_SPECIES[species];
}

/**
 * A refresh of any cell from the traits it holds: a giant's through `applyGiantBuild`, every other cell's straight
 * from its traits (what a balance patch of the trait tiers runs over the whole dish).
 */
export function refreshAnyCellFromItsTraits(cell: CellRecord, balance: BalanceConfig): void {
  if (cell.giantSpecies === null) {
    refreshCellDerivedStateFromTraits(cell, cell.traits, balance);
    return;
  }
  applyGiantBuild(cell, cell.giantSpecies, balance);
}
