// What a wild seat sees (docs/ecology/wild-cells.md §3.3.3, docs/architecture/server-simulation.md §3.4): the #15
// perception over the live `WorldState`, keyed by the seat's cell id instead of a player id (a wild cell has no
// player), built per decision around the deciding cell. It sees only what lies within its sight,
// `WILD_CELL_SIGHT_VIEW_MULTIPLE × viewHalfHeightFor(radius)` (what a player of its size sees from the middle of the
// screen to the top edge): every cell, player or wild, whose centre is in range, and the algae and detritus motes in
// range (bacteria and fragments are the players'). One linear pass over the cells and the motes, no spatial query.
// The hunt rule's view drops player cells before `WILD_CELL_HUNTS_PLAYERS_FROM_STAGE`; the flee rule sees them all.
// `canEngulf` is the shared predicate over the live balance, as for every bot. A `CellRecord` mirrors
// `membraneRatioBonus` at step 1, so it satisfies the strategies' `BotCellView` as is.

import { canEngulf, distanceBetween, viewHalfHeightFor, type BalanceConfig, type EntityId } from '@evolution/shared';
import type { BotPerception } from '../bots/perception.js';
import { isPlayerCell, type CellRecord, type FoodMoteRecord } from '../world/entities.js';
import { findCell } from '../world/lookups.js';
import type { WorldState } from '../world/world-state.js';
import { isWildFood } from '../simulation/eating.js';

export type WildPerception = BotPerception<WorldState, EntityId>;

/** How far a wild cell of `radius` sees (wu): a same-size player's view half-height times the sight multiple. */
export function wildSightRange(radius: number, balance: BalanceConfig): number {
  return balance.wildCells.WILD_CELL_SIGHT_VIEW_MULTIPLE * viewHalfHeightFor(radius);
}

/** What lies in one wild cell's sight this decision: the cells (itself included) and the motes it would eat. */
export interface WildSight {
  readonly cells: readonly CellRecord[];
  readonly motes: readonly FoodMoteRecord[];
}

/** One pass over the world: every centre within `wildSightRange` of `viewer`, the boundary included. */
export function wildSightOf(world: WorldState, viewer: CellRecord, balance: BalanceConfig): WildSight {
  const range = wildSightRange(viewer.radius, balance);
  const isInSight = (entity: { readonly x: number; readonly y: number }): boolean =>
    distanceBetween(viewer, entity) <= range;
  return {
    cells: world.cells.filter(isInSight),
    motes: world.food.filter((mote) => isWildFood(mote) && isInSight(mote)),
  };
}

/** The perception over `sight`; `isPlayerPrey` false leaves the player cells out (the hunt before its era). */
export function createWildPerception(sight: WildSight, balance: BalanceConfig, isPlayerPrey = true): WildPerception {
  const cells = isPlayerPrey ? sight.cells : sight.cells.filter((cell) => !isPlayerCell(cell));
  return {
    ownCellOf: (world, cellId) => findCell(world, cellId),
    cellsOf: () => cells,
    motesOf: () => sight.motes,
    canEngulf: (predator, prey) => canEngulf(predator, prey, balance.absorption),
  };
}
