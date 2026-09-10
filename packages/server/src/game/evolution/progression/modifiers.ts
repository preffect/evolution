// The per-tick fold (docs/TRAITS.md §2, docs/ARCHITECTURE.md §2): a cell's modifiers, stage,
// trait mirror and the `membraneRatioBonus` the shared engulf predicate reads, refreshed at step
// 1 right after trait choices apply. The fold itself is the shared `foldModifiers`.

import { foldModifiers, radiusForMass, type BalanceConfig } from '@evolution/shared';
import type { CellRecord, PlayerRecord } from '../world/entities.js';
import { stageOf } from './ladder.js';

/** Recomputes everything a cell derives from its player's traits and its mass. */
export function refreshCellDerivedState(cell: CellRecord, player: PlayerRecord, balance: BalanceConfig): void {
  cell.modifiers = foldModifiers(player.ownedTraits, balance.traits.TRAIT_TIERS);
  cell.traits = player.ownedTraits.map((owned) => ({ ...owned }));
  cell.stage = stageOf(player.ownedTraits);
  cell.membraneRatioBonus = cell.modifiers.membraneRatioBonus;
  cell.radius = radiusForMass(cell.mass, balance.growth);
}
