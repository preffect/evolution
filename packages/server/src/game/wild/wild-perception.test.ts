// docs/ecology/wild-cells.md §3.3 "Behaviour": what a wild seat sees through the #15 perception, keyed by its cell id.
import { describe, expect, it } from 'vitest';
import { CELL_KIND, DEFAULT_BALANCE, entityId } from '@evolution/shared';
import { createTestWorld } from '../../testing/world-builders.js';
import { setCellMass } from '../simulation/cell-mass.js';
import { createWildPerception } from './wild-perception.js';

const { absorption } = DEFAULT_BALANCE;

describe('createWildPerception', () => {
  const world = createTestWorld({ hasWildSeats: true });
  const perception = createWildPerception(world.balance);
  const player = world.cells[0]!;
  const wild = world.cells.find((cell) => cell.kind === CELL_KIND.wild)!;

  it('locates the own cell by its entity id, and nothing by an id that is not in the world', () => {
    expect(perception.ownCellOf(world, wild.id)).toBe(wild);
    expect(perception.ownCellOf(world, player.id)).toBe(player);
    expect(perception.ownCellOf(world, entityId('cell_nowhere'))).toBeUndefined();
  });

  it('sees the player cells only: wild never flees, hunts or engulfs wild', () => {
    expect(perception.cellsOf(world)).toEqual([player]);
  });

  it('sees no motes: a wild cell never eats', () => {
    expect(perception.motesOf(world)).toEqual([]);
  });

  it('answers the shared engulf predicate over the live absorption balance', () => {
    setCellMass(wild, 20, world.balance);
    setCellMass(player, 20 * absorption.ENGULF_MASS_RATIO, world.balance);
    expect(perception.canEngulf(player, wild)).toBe(true);
    expect(perception.canEngulf(wild, player)).toBe(false);
  });
});
