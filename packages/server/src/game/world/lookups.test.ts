import { describe, expect, it } from 'vitest';
import { entityId, playerId } from '@evolution/shared';
import { seatTestWildCell } from '../../testing/wild-builders.js';
import { createTestWorld, TEST_PLAYER } from '../../testing/world-builders.js';
import {
  findCell,
  findCellOfPlayer,
  findPlayer,
  indexCellsById,
  removeFromArray,
  requireCellOfPlayer,
  requirePlayer,
  seatedWildCells,
} from './lookups.js';
import { SimulationInvariantError } from './simulation-invariant-error.js';

describe('lookups', () => {
  it('finds a player and its cell by id', () => {
    const world = createTestWorld();
    expect(findPlayer(world, TEST_PLAYER.playerId)?.playerName).toBe('Alice');
    const cell = findCellOfPlayer(world, TEST_PLAYER.playerId);
    expect(cell?.playerId).toBe(TEST_PLAYER.playerId);
    expect(findCell(world, cell!.id)).toBe(cell);
  });

  it('returns undefined for unknown ids', () => {
    const world = createTestWorld();
    expect(findPlayer(world, playerId('nobody'))).toBeUndefined();
    expect(findCellOfPlayer(world, playerId('nobody'))).toBeUndefined();
    expect(findCell(world, entityId('c-999'))).toBeUndefined();
  });

  it('requirePlayer throws an invariant error for a missing player', () => {
    const world = createTestWorld();
    expect(requirePlayer(world, TEST_PLAYER.playerId)).toBe(world.players[0]);
    expect(() => requirePlayer(world, playerId('ghost'))).toThrow(SimulationInvariantError);
  });

  it('requireCellOfPlayer throws an invariant error for a player without a cell', () => {
    const world = createTestWorld();
    expect(requireCellOfPlayer(world, TEST_PLAYER.playerId)).toBe(world.cells[0]);
    world.cells = [];
    expect(() => requireCellOfPlayer(world, TEST_PLAYER.playerId)).toThrow(SimulationInvariantError);
  });

  it('removeFromArray removes by identity preserving order and ignores a missing item', () => {
    const items = ['a', 'b', 'c'];
    removeFromArray(items, 'b');
    expect(items).toEqual(['a', 'c']);
    removeFromArray(items, 'zzz');
    expect(items).toEqual(['a', 'c']);
  });

  it('indexCellsById holds every cell under its id', () => {
    const world = createTestWorld();
    const wild = seatTestWildCell(world, { seatNumber: 0, at: { x: 500, y: 0 } });
    const cellsById = indexCellsById(world);
    expect(cellsById.size).toBe(world.cells.length);
    expect(cellsById.get(wild.cell.id)).toBe(wild.cell);
    expect(cellsById.get(world.cells[0]!.id)).toBe(world.cells[0]);
  });

  it('seatedWildCells pairs each seat with its cell in seat order, leaving out a vacant seat and a vanished cell', () => {
    const world = createTestWorld();
    const [first, vacant, vanished, last] = [0, 1, 2, 3].map((seatNumber) =>
      seatTestWildCell(world, { seatNumber, at: { x: 500 * (seatNumber + 1), y: 0 } }),
    );
    vacant!.seat.cellId = null;
    removeFromArray(world.cells, vanished!.cell);
    world.cells.reverse();
    expect(seatedWildCells(world)).toEqual([first, last]);
  });
});
