// docs/ecology/wild-cells.md §3.3.1–§3.3.2 and docs/ecology/acceptance.md §8.1 W11, W3: the settle's pure core (a meal
// becomes growth, a loss recovers with the 6 s constant, the player's decay takes the growth alone, the ceiling at 3 ×
// the world's mass, the floor never lifts a small base to 20), the log-uniform size factor, and the world's ladder
// laid on every seated cell each tick.
import { describe, expect, it } from 'vitest';
import { CELL_STAGE, DEFAULT_BALANCE, radiusForMass, secondsToTicks } from '@evolution/shared';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { setCellMass } from '../simulation/cell-mass.js';
import { worldReferenceAt } from '../simulation/round-clock.js';
import type { CellRecord, WildSeatRecord } from '../world/entities.js';
import { cellOfSeat } from '../world/lookups.js';
import type { WorldState } from '../world/world-state.js';
import { createWildSeatRecord, placeWildCell } from './wild-seats.js';
import {
  settleWildCells,
  settleWildMass,
  wildRecoveryFactorPerTick,
  wildSizeFactor,
  type WildSettleInput,
} from './wild-settle.js';

const { growth, worldClock } = DEFAULT_BALANCE;
/** W11's tolerances: ± 0.001 on a settle, ± 0.01 on the recovery curve, ± 0.001 on a size factor. */
const SETTLE_DIGITS = 3;
const CURVE_TOLERANCE = 0.01;
const MASS_TOLERANCE = 0.01;
/** W3: the level-up tick of a 600 s round. */
const LEVEL_TWO_TICK = secondsToTicks(worldClock.WORLD_LEVEL_SECONDS);
/** W11's recovery curve: a 100-mass loss with the full size held fixed. */
const CURVE_LOSS = 100;
const TEN_SECONDS_TICKS = 600;
const EIGHTEEN_SECONDS_TICKS = 1080;

/** W11's inputs in its order: (mass, fullMass, grownMass, decayPerSecond, baseMass, worldMass). */
type SettleRow = readonly [number, number, number, number, number, number];

function settle([mass, fullMass, grownMass, decayPerSecond, baseMass, worldMass]: SettleRow) {
  const input: WildSettleInput = { mass, fullMass, grownMass, decayPerSecond, baseMass, worldMass };
  return settleWildMass(input, DEFAULT_BALANCE);
}

describe('settleWildMass (W11)', () => {
  it('leaves a cell at its full size with no growth where it is: decay has nothing to take', () => {
    expect(settle([494, 494, 0, 0.948, 494.02, 380.02])).toEqual({ mass: 494.02, grownMass: 0, fullMass: 494.02 });
  });

  it('recovers a loss by q = 1 − 1/360 a tick toward the new full size', () => {
    const settled = settle([416.45, 494.5, 0, 0.793, 494.52, 380.4]);
    expect(settled.mass).toBeCloseTo(416.687, SETTLE_DIGITS);
    expect(settled.fullMass).toBe(494.52);
    expect(settle([95, 100, 0, 1.6, 100, 50]).mass).toBeCloseTo(95.014, SETTLE_DIGITS);
  });

  it('keeps a meal as growth, less one tick of the player decay', () => {
    const settled = settle([60, 40, 0, 0.08, 40.0333, 20.0167]);
    expect(settled.grownMass).toBeCloseTo(19.99867, 5);
    expect(settled.mass).toBeCloseTo(60.032, SETTLE_DIGITS);
    expect(settled.mass).toBe(settled.fullMass);
  });

  it('stops growth at 3 × the world mass and keeps a base above the ceiling whole', () => {
    const capped = settle([70, 40, 0, 0.1, 40.0333, 20.0167]);
    expect(capped.mass).toBeCloseTo(60.05, SETTLE_DIGITS);
    expect(capped.grownMass).toBeCloseTo(20.0167, SETTLE_DIGITS);
    const free = settle([2000, 2000, 1000, 3.96, 1000, 700]);
    expect(free.grownMass).toBeCloseTo(999.934, SETTLE_DIGITS);
    expect(free.mass).toBeCloseTo(1999.934, SETTLE_DIGITS);
    const lowCeiling = settle([2000, 2000, 1000, 3.96, 1000, 400]);
    expect([lowCeiling.mass, lowCeiling.grownMass]).toEqual([1200, 200]);
    expect(settle([100, 40, 0, 0.16, 110, 22])).toEqual({ mass: 110, grownMass: 0, fullMass: 110 });
  });

  it('never lifts a base below 20 to 20', () => {
    expect(settle([10, 10, 0, 0, 10.0083, 20.0167]).mass).toBeCloseTo(10.0083, 4);
  });

  it('recovers a 100-mass loss to 18.84 after 600 applications and 4.96 after 1 080', () => {
    const deficitAfter = (settleCount: number): number => {
      let mass = CURVE_LOSS;
      for (let tick = 0; tick < settleCount; tick += 1) {
        mass = settle([mass, 2 * CURVE_LOSS, 0, 0, 2 * CURVE_LOSS, 2 * CURVE_LOSS]).mass;
      }
      return 2 * CURVE_LOSS - mass;
    };
    expect(Math.abs(deficitAfter(TEN_SECONDS_TICKS) - 18.84)).toBeLessThanOrEqual(CURVE_TOLERANCE);
    expect(Math.abs(deficitAfter(EIGHTEEN_SECONDS_TICKS) - 4.96)).toBeLessThanOrEqual(CURVE_TOLERANCE);
    expect(wildRecoveryFactorPerTick(DEFAULT_BALANCE)).toBeCloseTo(1 - 1 / 360, 12);
  });
});

describe('wildSizeFactor (W11)', () => {
  it('maps u 0 → 0.5, 0.5 → 1.0, 0.999 → 1.997 (log-uniform on [0.5, 2.0])', () => {
    expect(wildSizeFactor(0, DEFAULT_BALANCE)).toBeCloseTo(0.5, SETTLE_DIGITS);
    expect(wildSizeFactor(0.5, DEFAULT_BALANCE)).toBeCloseTo(1, SETTLE_DIGITS);
    expect(wildSizeFactor(0.999, DEFAULT_BALANCE)).toBeCloseTo(1.997, SETTLE_DIGITS);
  });
});

function seatedWorld(seatNumber = 0): { world: WorldState; seat: WildSeatRecord; cell: CellRecord } {
  const world = createTestWorld();
  const seat = createWildSeatRecord(seatNumber);
  world.wildSeats.push(seat);
  const cell = placeWildCell(world, seat, createTestStepContext(world), worldReferenceAt(world, world.tick));
  return { world, seat, cell };
}

function settleAt(world: WorldState, tick: number): void {
  world.tick = tick;
  settleWildCells(world, createTestStepContext(world));
}

describe('settleWildCells (W3)', () => {
  it('after tick 10 799 every wild cell is level 1, no traits, at 199.983 × its size', () => {
    const { world, seat, cell } = seatedWorld();
    settleAt(world, LEVEL_TWO_TICK - 1);
    expect(cell.level).toBe(1);
    expect(cell.traits).toEqual([]);
    expect(cell.stage).toBe(CELL_STAGE.protocell);
    expect(Math.abs(cell.mass - 199.983 * seat.sizeFactor)).toBeLessThanOrEqual(MASS_TOLERANCE);
    expect(cell.radius).toBe(radiusForMass(cell.mass, growth));
    expect([seat.grownMass, seat.fullMass]).toEqual([0, cell.mass]);
  });

  it('after tick 10 800 every wild cell is level 2, owns nucleoid I, stage prokaryote, at 200 × its size', () => {
    const { world, seat, cell } = seatedWorld();
    settleAt(world, LEVEL_TWO_TICK);
    expect(cell.level).toBe(2);
    expect(cell.traits).toEqual([{ traitId: 'nucleoid', tier: 1 }]);
    expect(cell.stage).toBe(CELL_STAGE.prokaryote);
    expect(Math.abs(cell.mass - 200 * seat.sizeFactor)).toBeLessThanOrEqual(MASS_TOLERANCE);
    expect(cell.modifiers.dnaGainMultiplier).toBeGreaterThan(1);
  });

  it("lays each seat's own build: seat 1 owns chloroplast at level 3 and reaches the world stage", () => {
    const { world, cell } = seatedWorld(1);
    settleAt(world, 2 * LEVEL_TWO_TICK);
    const reference = worldReferenceAt(world, world.tick);
    expect(cell.level).toBe(3);
    expect(cell.traits.map((trait) => trait.traitId)).toEqual(['nucleoid', 'chloroplast']);
    expect(cell.stage).toBe(reference.worldStage);
    expect(cell.modifiers.photosynthesisMassPerSecond).toBeGreaterThan(0);
  });

  it("turns what the cell gained since the last settle into the seat's growth, less the player decay", () => {
    const { world, seat, cell } = seatedWorld();
    const meal = 5;
    setCellMass(cell, seat.fullMass + meal, world.balance);
    settleAt(world, world.tick);
    expect(seat.grownMass).toBeGreaterThan(meal - MASS_TOLERANCE);
    expect(seat.grownMass).toBeLessThan(meal);
    expect(cell.mass).toBe(seat.fullMass);
  });

  it('skips a vacant seat and leaves player cells alone', () => {
    const { world, seat, cell } = seatedWorld();
    const player = world.cells[0]!;
    const playerMassBefore = player.mass;
    world.cells = world.cells.filter((entry) => entry !== cell);
    settleAt(world, LEVEL_TWO_TICK);
    expect(player.mass).toBe(playerMassBefore);
    expect(seat.cellId).toBe(cell.id);
    expect(cellOfSeat(world, seat)).toBeUndefined();
  });
});
