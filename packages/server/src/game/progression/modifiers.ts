// The per-tick fold (docs/traits/model.md §2, docs/architecture/entity-model.md §2): a cell's modifiers, stage,
// trait mirror and the `membraneRatioBonus` the shared engulf predicate reads, refreshed at step
// 1 right after trait choices apply. The fold itself is the shared `foldModifiers`. A player cell
// folds its player's traits; a wild cell folds the build the world clock hands it (docs/ecology/wild-cells.md §3.3).

import { foldModifiers, radiusForMass, type BalanceConfig, type OwnedTrait } from '@evolution/shared';
import type { CellRecord, PlayerRecord } from '../world/entities.js';
import { stageOfOwned } from './ladder.js';

/** Recomputes everything a cell derives from `ownedTraits` and its mass. */
export function refreshCellDerivedStateFromTraits(
  cell: CellRecord,
  ownedTraits: readonly OwnedTrait[],
  balance: BalanceConfig,
): void {
  cell.modifiers = foldModifiers(ownedTraits, balance.traits.TRAIT_TIERS);
  cell.traits = ownedTraits.map((owned) => ({ ...owned }));
  cell.stage = stageOfOwned(ownedTraits, balance);
  cell.membraneRatioBonus = cell.modifiers.membraneRatioBonus;
  cell.radius = radiusForMass(cell.mass, balance.growth);
}

/** Recomputes everything a cell derives from its player's traits and its mass. */
export function refreshCellDerivedState(cell: CellRecord, player: PlayerRecord, balance: BalanceConfig): void {
  refreshCellDerivedStateFromTraits(cell, player.ownedTraits, balance);
}
