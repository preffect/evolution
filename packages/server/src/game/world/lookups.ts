// Record lookups by id over the world's arrays. Single lookups are linear scans: the arrays are small and
// insertion-ordered by contract, so no index to keep in sync. A pass that looks up a cell per seat builds a
// throwaway id index once instead (#509), so the world keeps no index either.

import type { EntityId, PlayerId } from '@evolution/shared';
import type { CellRecord, GiantSeatRecord, PlayerRecord, SeatMindRecord, WildSeatRecord } from './entities.js';
import { SimulationInvariantError } from './simulation-invariant-error.js';
import type { WorldState } from './world-state.js';

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

/** The cell must exist: an alive player without a cell is an invariant break, never a zero. */
export function requireCellOfPlayer(world: WorldState, playerId: PlayerId): CellRecord {
  const cell = findCellOfPlayer(world, playerId);
  if (cell === undefined) {
    throw new SimulationInvariantError(`player ${playerId} has no cell in the world`);
  }
  return cell;
}

export function findCell(world: WorldState, cellId: EntityId): CellRecord | undefined {
  return world.cells.find((cell) => cell.id === cellId);
}

/** The seat's cell, or `undefined` while the seat is vacant. */
export function cellOfSeat(world: WorldState, seat: SeatMindRecord): CellRecord | undefined {
  return seat.cellId === null ? undefined : findCell(world, seat.cellId);
}

/** The giant seat whose cell this is, or `undefined` for any other cell. */
export function giantSeatOfCell(world: WorldState, cellId: EntityId): GiantSeatRecord | undefined {
  return world.giantSeats.find((seat) => seat.cellId === cellId);
}

/** The world's cells by id, for one pass that looks up many; stale once a cell is added or removed. */
export function indexCellsById(world: WorldState): ReadonlyMap<EntityId, CellRecord> {
  return new Map(world.cells.map((cell) => [cell.id, cell]));
}

/** A seated seat and its cell. */
export interface SeatedCell<Seat extends SeatMindRecord> {
  readonly seat: Seat;
  readonly cell: CellRecord;
}

export type SeatedWildCell = SeatedCell<WildSeatRecord>;
export type SeatedGiantCell = SeatedCell<GiantSeatRecord>;

/** The seated seats of `seats` with their cells, in seat order; a vacant seat, or one whose cell is gone, is left out. */
function seatedCellsOf<Seat extends SeatMindRecord>(world: WorldState, seats: readonly Seat[]): SeatedCell<Seat>[] {
  const cellsById = indexCellsById(world);
  const seated: SeatedCell<Seat>[] = [];
  for (const seat of seats) {
    const cell = seat.cellId === null ? undefined : cellsById.get(seat.cellId);
    if (cell !== undefined) {
      seated.push({ seat, cell });
    }
  }
  return seated;
}

/** The seated wild seats with their cells, in seat order. */
export function seatedWildCells(world: WorldState): SeatedWildCell[] {
  return seatedCellsOf(world, world.wildSeats);
}

/** The seated giant seats with their cells, in seat order. */
export function seatedGiantCells(world: WorldState): SeatedGiantCell[] {
  return seatedCellsOf(world, world.giantSeats);
}

/** Removes by identity, preserving order (docs/determinism/ordering-and-state-hash.md §4: never swap-remove). */
export function removeFromArray<Item>(items: Item[], item: Item): void {
  const index = items.indexOf(item);
  if (index >= 0) {
    items.splice(index, 1);
  }
}
