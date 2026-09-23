// docs/ecology/mass-and-movement.md §5.4 (E12) on the mass cap; the wild floor (docs/architecture/server-simulation.md §3.4).
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, radiusForMass } from '@evolution/shared';
import { seatTestWildCell } from '../../testing/wild-builders.js';
import { createTestWorld } from '../../testing/world-builders.js';
import { gainMass, loseMassToFloor, massFloorOf, setCellMass } from './cell-mass.js';

const { growth } = DEFAULT_BALANCE;
/** A wild cell born below the starting mass (size 0.5 at tick 0). */
const SMALL_WILD_MASS = 10;

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

  it('clamps a cell with no player (a wild cell) to the cap and grants no DNA', () => {
    const { cell, player } = cellAndPlayer();
    setCellMass(cell, growth.CELL_MAX_MASS - 1, DEFAULT_BALANCE);
    gainMass(cell, undefined, 3, DEFAULT_BALANCE);
    expect(cell.mass).toBe(growth.CELL_MAX_MASS);
    expect(cell.radius).toBeCloseTo(radiusForMass(growth.CELL_MAX_MASS, growth), 12);
    expect(player.dnaCumulative).toBe(0);
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

describe('massFloorOf and the wild floor', () => {
  it('floors a player cell at the starting mass and a wild cell at min(starting mass, its mass before)', () => {
    const world = createTestWorld();
    const player = world.cells[0]!;
    const { cell: wild } = seatTestWildCell(world, { at: { x: 1500, y: 0 }, mass: SMALL_WILD_MASS });
    expect(massFloorOf(player, SMALL_WILD_MASS, DEFAULT_BALANCE)).toBe(growth.CELL_STARTING_MASS);
    expect(massFloorOf(wild, SMALL_WILD_MASS, DEFAULT_BALANCE)).toBe(SMALL_WILD_MASS);
    expect(massFloorOf(wild, 50, DEFAULT_BALANCE)).toBe(growth.CELL_STARTING_MASS);
  });

  it('never lifts a drained 10-mass wild cell to 20, and a heavy one stops at 20', () => {
    const world = createTestWorld();
    const { cell: wild } = seatTestWildCell(world, { at: { x: 1500, y: 0 }, mass: SMALL_WILD_MASS });
    loseMassToFloor(wild, SMALL_WILD_MASS - 1, DEFAULT_BALANCE);
    expect(wild.mass).toBe(SMALL_WILD_MASS);
    setCellMass(wild, 30, DEFAULT_BALANCE);
    loseMassToFloor(wild, 5, DEFAULT_BALANCE);
    expect(wild.mass).toBe(growth.CELL_STARTING_MASS);
  });
});
