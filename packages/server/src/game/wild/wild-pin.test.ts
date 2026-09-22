// docs/ecology/wild-cells.md §3.3 (the pin formula, "Bleeding while engulfing") and docs/ecology/acceptance.md §8.1 W3:
// mass, level, traits and stage from the world reference every tick; `drainedMass` subtracted while engulfing and
// cleared on the first pin of a free cell.
import { describe, expect, it } from 'vitest';
import { CELL_STAGE, DEFAULT_BALANCE, radiusForMass, secondsToTicks, worldReference } from '@evolution/shared';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { beginEngulf } from '../simulation/engulf-state.js';
import { worldReferenceAt } from '../simulation/round-clock.js';
import type { CellRecord, WildSeatRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';
import { pinnedWildMass, pinWildCell, pinWildCells, recordWildDrain, wildSeatOfCell } from './wild-pin.js';
import { createWildSeatRecord, placeWildCell } from './wild-seats.js';

const { growth, worldClock } = DEFAULT_BALANCE;
const MASS_TOLERANCE = 0.01;
/** W3: the tick before the first world level-up and the level-up tick of a 600 s round. */
const LEVEL_TWO_TICK = secondsToTicks(worldClock.WORLD_LEVEL_SECONDS);

function seatedWorld(seatNumber = 0): { world: WorldState; seat: WildSeatRecord; cell: CellRecord } {
  const world = createTestWorld();
  const seat = createWildSeatRecord(seatNumber);
  world.wildSeats.push(seat);
  const cell = placeWildCell(world, seat, createTestStepContext(world), worldReferenceAt(world, world.tick));
  return { world, seat, cell };
}

function pinAt(world: WorldState, tick: number): void {
  world.tick = tick;
  pinWildCells(world, createTestStepContext(world));
}

describe('pinnedWildMass', () => {
  it('is worldMass × spread − drainedMass, floored at the starting mass by the bleed', () => {
    const reference = worldReference(100, DEFAULT_BALANCE);
    const seat = { ...createWildSeatRecord(0), massSpreadFactor: 1.2 };
    expect(pinnedWildMass(seat, reference, DEFAULT_BALANCE)).toBeCloseTo(120 * 1.2, 10);
    seat.drainedMass = 4;
    expect(pinnedWildMass(seat, reference, DEFAULT_BALANCE)).toBeCloseTo(120 * 1.2 - 4, 10);
    seat.drainedMass = 1000;
    expect(pinnedWildMass(seat, reference, DEFAULT_BALANCE)).toBe(growth.CELL_STARTING_MASS);
  });

  it('lets a light spread sit below the starting mass (W2: 14 at tick 0), and a bleed never raises it', () => {
    const reference = worldReference(0, DEFAULT_BALANCE);
    const seat = { ...createWildSeatRecord(0), massSpreadFactor: 0.7 };
    expect(pinnedWildMass(seat, reference, DEFAULT_BALANCE)).toBeCloseTo(14, 10);
    seat.drainedMass = 1;
    expect(pinnedWildMass(seat, reference, DEFAULT_BALANCE)).toBeCloseTo(14, 10);
  });
});

describe('pinWildCells (W3)', () => {
  it('after tick 10 799 every wild cell is level 1, no traits, mass 199.983 × its spread', () => {
    const { world, seat, cell } = seatedWorld();
    pinAt(world, LEVEL_TWO_TICK - 1);
    expect(cell.level).toBe(1);
    expect(cell.traits).toEqual([]);
    expect(cell.stage).toBe(CELL_STAGE.protocell);
    expect(Math.abs(cell.mass - 199.983 * seat.massSpreadFactor)).toBeLessThanOrEqual(MASS_TOLERANCE);
    expect(cell.radius).toBe(radiusForMass(cell.mass, growth));
  });

  it('after tick 10 800 every wild cell is level 2, owns nucleoid I, stage prokaryote, mass 200 × its spread', () => {
    const { world, seat, cell } = seatedWorld();
    pinAt(world, LEVEL_TWO_TICK);
    expect(cell.level).toBe(2);
    expect(cell.traits).toEqual([{ traitId: 'nucleoid', tier: 1 }]);
    expect(cell.stage).toBe(CELL_STAGE.prokaryote);
    expect(Math.abs(cell.mass - 200 * seat.massSpreadFactor)).toBeLessThanOrEqual(MASS_TOLERANCE);
    expect(cell.modifiers.dnaGainMultiplier).toBeGreaterThan(1);
  });

  it('pins each seat to its own build: seat 1 owns chloroplast at level 3 and reaches the world stage', () => {
    const { world, cell } = seatedWorld(1);
    pinAt(world, 2 * LEVEL_TWO_TICK);
    const reference = worldReferenceAt(world, world.tick);
    expect(cell.level).toBe(3);
    expect(cell.traits.map((trait) => trait.traitId)).toEqual(['nucleoid', 'chloroplast']);
    expect(cell.stage).toBe(reference.worldStage);
    expect(cell.modifiers.photosynthesisMassPerSecond).toBeGreaterThan(0);
  });

  it('skips a vacant seat and leaves player cells alone', () => {
    const { world, seat, cell } = seatedWorld();
    const player = world.cells[0]!;
    const playerMassBefore = player.mass;
    world.cells = world.cells.filter((entry) => entry !== cell);
    pinAt(world, LEVEL_TWO_TICK);
    expect(player.mass).toBe(playerMassBefore);
    expect(seat.cellId).toBe(cell.id);
  });
});

describe('the drain while engulfing', () => {
  it('books a drain only for a wild cell and subtracts it from the pin while the cell is engulfing', () => {
    const { world, seat, cell } = seatedWorld();
    const player = world.cells[0]!;
    recordWildDrain(world, player, 5);
    expect(seat.drainedMass).toBe(0);
    beginEngulf({ predator: cell, prey: player });
    recordWildDrain(world, cell, 0.5);
    recordWildDrain(world, cell, 0.29);
    expect(seat.drainedMass).toBeCloseTo(0.79, 10);
    world.tick = 600;
    const reference = worldReferenceAt(world, world.tick);
    pinWildCell(cell, seat, reference, DEFAULT_BALANCE);
    expect(cell.mass).toBeCloseTo(30 * seat.massSpreadFactor - 0.79, 10);
    expect(seat.drainedMass).toBeCloseTo(0.79, 10);
  });

  it('re-pins a free cell in full and clears the drain on that pin', () => {
    const { world, seat, cell } = seatedWorld();
    seat.drainedMass = 3;
    world.tick = 600;
    pinWildCell(cell, seat, worldReferenceAt(world, world.tick), DEFAULT_BALANCE);
    expect(seat.drainedMass).toBe(0);
    expect(cell.mass).toBeCloseTo(30 * seat.massSpreadFactor, 10);
  });

  it('finds a seat by its cell and nothing for a player cell', () => {
    const { world, seat, cell } = seatedWorld();
    expect(wildSeatOfCell(world, cell)).toBe(seat);
    expect(wildSeatOfCell(world, world.cells[0]!)).toBeUndefined();
  });
});
