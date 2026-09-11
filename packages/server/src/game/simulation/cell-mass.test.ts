// docs/ECOLOGY.md §5.4 (E12) on the mass cap.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, radiusForMass } from '@evolution/shared';
import { createTestWorld } from '../../testing/world-builders.js';
import { gainMass, loseMassToFloor, setCellMass } from './cell-mass.js';

const { growth } = DEFAULT_BALANCE;

function cellAndPlayer() {
  const world = createTestWorld();
  return { cell: world.cells[0]!, player: world.players[0]! };
}

describe('setCellMass', () => {
  it('sets the mass and the radius from the curve', () => {
    const { cell } = cellAndPlayer();
    setCellMass(cell, 80, DEFAULT_BALANCE);
    expect(cell.mass).toBe(80);
    expect(cell.radius).toBeCloseTo(radiusForMass(80, growth), 12);
  });
});

describe('gainMass', () => {
  it('adds mass below the cap without DNA', () => {
    const { cell, player } = cellAndPlayer();
    gainMass(cell, player, 1, DEFAULT_BALANCE);
    expect(cell.mass).toBe(growth.CELL_STARTING_MASS + 1);
    expect(player.dnaCumulative).toBe(0);
  });

  it('E12: converts the overflow above CELL_MAX_MASS to DNA and holds the mass at the cap', () => {
    const { cell, player } = cellAndPlayer();
    setCellMass(cell, growth.CELL_MAX_MASS, DEFAULT_BALANCE);
    gainMass(cell, player, 1, DEFAULT_BALANCE);
    expect(cell.mass).toBe(growth.CELL_MAX_MASS);
    expect(player.dnaCumulative).toBeCloseTo(growth.MASS_OVERFLOW_DNA_PER_MASS, 12);
    expect(player.dnaTowardNextLevel).toBeCloseTo(growth.MASS_OVERFLOW_DNA_PER_MASS, 12);
  });

  it('applies the DNA gain multiplier to the overflow DNA', () => {
    const { cell, player } = cellAndPlayer();
    cell.modifiers.dnaGainMultiplier = 2;
    setCellMass(cell, growth.CELL_MAX_MASS - 1, DEFAULT_BALANCE);
    gainMass(cell, player, 3, DEFAULT_BALANCE);
    expect(player.dnaCumulative).toBeCloseTo(2 * growth.MASS_OVERFLOW_DNA_PER_MASS * 2, 12);
  });
});

describe('loseMassToFloor', () => {
  it('never drops below the starting mass', () => {
    const { cell } = cellAndPlayer();
    setCellMass(cell, 30, DEFAULT_BALANCE);
    loseMassToFloor(cell, 25, DEFAULT_BALANCE);
    expect(cell.mass).toBe(25);
    loseMassToFloor(cell, 5, DEFAULT_BALANCE);
    expect(cell.mass).toBe(growth.CELL_STARTING_MASS);
    expect(cell.radius).toBeCloseTo(radiusForMass(growth.CELL_STARTING_MASS, growth), 12);
  });
});
