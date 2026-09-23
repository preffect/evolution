// What a wild seat sees (docs/ecology/wild-cells.md §3.3, docs/testing/bots-and-design-tables.md §8.3): the #15
// perception over the live `WorldState`, keyed by the seat's cell id instead of a player id (a wild cell has no
// player). It sees player cells only: wild never flees, hunts or engulfs wild (`WORLD_ORGANISM_ID`, "same organism",
// docs/ecology/absorption.md §6.3), and it sees no motes: it eats what it touches (step 4) but does not seek food. `canEngulf` is the shared predicate
// over the live balance, as for every bot. A `CellRecord` mirrors `membraneRatioBonus` at step 1, so it satisfies
// the strategies' `BotCellView` as is.

import { canEngulf, type BalanceConfig, type EntityId } from '@evolution/shared';
import type { BotPerception } from '../bots/perception.js';
import { isPlayerCell } from '../world/entities.js';
import { findCell } from '../world/lookups.js';
import type { WorldState } from '../world/world-state.js';

export type WildPerception = BotPerception<WorldState, EntityId>;

export function createWildPerception(balance: BalanceConfig): WildPerception {
  return {
    ownCellOf: (world, cellId) => findCell(world, cellId),
    cellsOf: (world) => world.cells.filter(isPlayerCell),
    motesOf: () => [],
    canEngulf: (predator, prey) => canEngulf(predator, prey, balance.absorption),
  };
}
