// Record lookups by id over the world's arrays. Linear scans: the arrays are small (≤ 8 players
// and cells) and insertion-ordered by contract, so no index to keep in sync.

import type { EntityId, PlayerId } from '@evolution/shared';
import type { CellRecord, PlayerRecord } from './entities.js';
import type { WorldState } from './world-state.js';

export class SimulationInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimulationInvariantError';
  }
}

export function findPlayer(world: WorldState, playerId: PlayerId): PlayerRecord | undefined {
  return world.players.find((player) => player.playerId === playerId);
}

/** The player must exist: a system referencing a missing player is a bug, never player input. */
export function requirePlayer(world: WorldState, playerId: PlayerId): PlayerRecord {
  const player = findPlayer(world, playerId);
  if (player === undefined) {
    throw new SimulationInvariantError(`player ${playerId} is not in the world`);
  }
  return player;
}

export function findCellOfPlayer(world: WorldState, playerId: PlayerId): CellRecord | undefined {
  return world.cells.find((cell) => cell.playerId === playerId);
}

export function findCell(world: WorldState, cellId: EntityId): CellRecord | undefined {
  return world.cells.find((cell) => cell.id === cellId);
}

/** Removes by identity, preserving order (docs/DETERMINISM.md §4: never swap-remove). */
export function removeFromArray<Item>(items: Item[], item: Item): void {
  const index = items.indexOf(item);
  if (index >= 0) {
    items.splice(index, 1);
  }
}
