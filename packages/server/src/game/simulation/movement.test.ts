// docs/ECOLOGY.md §5.2 (E6, E8), docs/GAME-DESIGN.md §6, §8 (G4–G6) and docs/TRAITS.md §6 (T2).
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  gelSpeedFactor,
  maxSpeedForMass,
  radiusForMass,
  TICK_INTERVAL_S,
  type Vec2,
} from '@evolution/shared';
import { BROTH_POINT } from '../../testing/gameplay/placement.js';
import { refreshCellDerivedState } from '../progression/modifiers.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import type { CellRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';
import { setCellMass } from './cell-mass.js';
import {
  ENGULF_CENTRE_DISTANCE_WU,
  ENGULF_PREDATOR_MASS,
  ENGULF_PREY_MASS,
  createEngulfFixture,
  type EngulfFixture,
} from '../../testing/engulf-builders.js';
import { beginEngulf, sealEngulf } from './engulf-state.js';
import { engulfSpeedFactor, moveCells, speedCapOf, sprintSpeedFactor, zoneSpeedFactor } from './movement.js';

const { growth, controls, world: worldBalance } = DEFAULT_BALANCE;
const BLEND = TICK_INTERVAL_S / growth.CELL_ACCELERATION_SECONDS;
const TARGET_RADII = 5;

/**
 * Seed 42's first gel patch covers the broth point (reported to the parent); the movement rules are
 * tested with the patches cleared, and E8 puts the cell on a patch on purpose.
 */
function placedCell(mass: number, centre: Vec2 = BROTH_POINT): { world: WorldState; cell: CellRecord } {
  const world = createTestWorld();
  world.gelPatches = [];
  const cell = world.cells[0]!;
  cell.x = centre.x;
  cell.y = centre.y;
  setCellMass(cell, mass, DEFAULT_BALANCE);
  return { world, cell };
}

/** "Target N radii east" measured from the current centre every tick (docs/ECOLOGY.md §8). */
function moveEastFor(world: WorldState, cell: CellRecord, ticks: number): void {
  const context = createTestStepContext(world);
  for (let tick = 0; tick < ticks; tick += 1) {
    cell.targetX = cell.x + TARGET_RADII * cell.radius;
    cell.targetY = cell.y;
    moveCells(world, context);
  }
}

const speedOf = (cell: CellRecord): number => Math.hypot(cell.velocityX, cell.velocityY);

describe('moveCells', () => {
  it('G4: reaches 216.5 wu/s east after 60 ticks at full throttle', () => {
    const { world, cell } = placedCell(growth.CELL_STARTING_MASS);
    moveEastFor(world, cell, 60);
    expect(cell.velocityX).toBeCloseTo(growth.CELL_BASE_SPEED * (1 - (1 - BLEND) ** 60), 1);
    expect(Math.abs(cell.velocityX - 216.5)).toBeLessThan(0.5);
    expect(cell.velocityY).toBe(0);
  });

  it('G5: a target inside the dead zone gives speed 0', () => {
    const { world, cell } = placedCell(growth.CELL_STARTING_MASS);
    cell.targetX = cell.x + controls.STEER_DEAD_ZONE_RADII * cell.radius * 0.5;
    cell.targetY = cell.y;
    const context = createTestStepContext(world);
    for (let tick = 0; tick < 60; tick += 1) moveCells(world, context);
    expect(speedOf(cell)).toBe(0);
  });

  it('G6: clamps to DISH_RADIUS − radius at the wall and zeroes the outward velocity', () => {
    const { world, cell } = placedCell(growth.CELL_STARTING_MASS, { x: 2900, y: 0 });
    cell.targetX = 4000;
    cell.targetY = 0;
    const context = createTestStepContext(world);
    for (let tick = 0; tick < 120; tick += 1) moveCells(world, context);
    expect(cell.x).toBeCloseTo(worldBalance.DISH_RADIUS - cell.radius, 9);
    expect(cell.velocityX).toBe(0);
  });

  it.each([
    [320, 110.1],
    [5000, 55.4],
  ])('E6: mass %d converges to the curve speed %f (no decay here)', (mass, expectedSpeed) => {
    const { world, cell } = placedCell(mass);
    moveEastFor(world, cell, 120);
    expect(Math.abs(speedOf(cell) - maxSpeedForMass(mass, growth))).toBeLessThan(0.5);
    // The design's number includes 120 ticks of decay on the placed mass; within a wu/s of it.
    expect(Math.abs(speedOf(cell) - expectedSpeed)).toBeLessThan(1);
  });

  it('E8: a 500-mass cell at a gel patch centre moves at the gel-slowed speed and stays inside', () => {
    const world = createTestWorld();
    const patch = world.gelPatches[0]!;
    const cell = world.cells[0]!;
    cell.x = patch.x;
    cell.y = patch.y;
    setCellMass(cell, 500, DEFAULT_BALANCE);
    moveEastFor(world, cell, 120);
    const expected = maxSpeedForMass(500, growth) * gelSpeedFactor(500, growth, 0);
    expect(Math.abs(speedOf(cell) - expected)).toBeLessThan(0.5);
    expect(Math.abs(speedOf(cell) - 49.4)).toBeLessThan(1);
    expect(Math.hypot(cell.x - patch.x, cell.y - patch.y)).toBeLessThan(patch.radius);
    expect(cell.x - patch.x).toBeGreaterThan(80);
  });

  it('T2: cilia I at the origin converges to 242 wu/s', () => {
    const { world, cell } = placedCell(growth.CELL_STARTING_MASS, { x: 0, y: 0 });
    world.players[0]!.ownedTraits.push({ traitId: 'cilia', tier: 1 });
    refreshCellDerivedState(cell, world.players[0]!, DEFAULT_BALANCE);
    moveEastFor(world, cell, 120);
    expect(Math.abs(speedOf(cell) - 242)).toBeLessThan(0.5);
  });

  it('ticks the sprint counters down to zero and applies the sprint factor while it runs', () => {
    const { world, cell } = placedCell(growth.CELL_STARTING_MASS);
    cell.sprintRemainingTicks = 2;
    cell.sprintCooldownRemainingTicks = 3;
    expect(sprintSpeedFactor(cell, DEFAULT_BALANCE)).toBe(controls.SPRINT_SPEED_MULTIPLIER);
    expect(speedCapOf(cell, world, DEFAULT_BALANCE)).toBeCloseTo(
      growth.CELL_BASE_SPEED * controls.SPRINT_SPEED_MULTIPLIER,
      9,
    );
    const context = createTestStepContext(world);
    moveCells(world, context);
    moveCells(world, context);
    expect(cell.sprintRemainingTicks).toBe(0);
    expect(cell.sprintCooldownRemainingTicks).toBe(1);
    expect(sprintSpeedFactor(cell, DEFAULT_BALANCE)).toBe(1);
    moveCells(world, context);
    moveCells(world, context);
    expect(cell.sprintCooldownRemainingTicks).toBe(0);
  });

  it('adds the flagellum sprint bonus to the sprint multiplier', () => {
    const { world, cell } = placedCell(growth.CELL_STARTING_MASS);
    cell.sprintRemainingTicks = 1;
    cell.modifiers.sprintSpeedMultiplierBonus = 0.3;
    cell.modifiers.speedMultiplier = 1.05;
    expect(speedCapOf(cell, world, DEFAULT_BALANCE)).toBeCloseTo(231 * 2.1, 9);
  });

  it('restores a pinned cell after movement', () => {
    const { world, cell } = placedCell(growth.CELL_STARTING_MASS);
    cell.pinnedX = cell.x;
    cell.pinnedY = cell.y;
    moveEastFor(world, cell, 30);
    expect(cell.x).toBe(BROTH_POINT.x);
    expect(cell.y).toBe(BROTH_POINT.y);
    expect(speedOf(cell)).toBeGreaterThan(0);
  });

  it('zoneSpeedFactor is 1 outside the gel and the gel curve inside it', () => {
    const { world, cell } = placedCell(600);
    expect(zoneSpeedFactor(cell, world, DEFAULT_BALANCE)).toBe(1);
    world.gelPatches = [{ x: cell.x, y: cell.y, radius: DEFAULT_BALANCE.ecology.GEL_PATCH_RADIUS }];
    expect(zoneSpeedFactor(cell, world, DEFAULT_BALANCE)).toBeCloseTo(0.4, 9);
    cell.modifiers.gelSpeedFactorFloor = 0.8;
    expect(zoneSpeedFactor(cell, world, DEFAULT_BALANCE)).toBe(0.8);
    expect(cell.radius).toBeCloseTo(radiusForMass(600, growth), 9);
  });
});

/** The sprint clocks a carried prey must keep spending (docs/GAME-DESIGN.md §6). */
const SPRINT_TICKS = 30;
const COOLDOWN_TICKS = 180;
/** C sits just inside B in the chain row; the exact gap only has to be held tick to tick. */
const CHAIN_OFFSET_WU = 1;
/** A float comparison on a clamped radius, where the clamp is exact to within rounding. */
const CLAMP_TOLERANCE_WU = 1e-9;

/** The E9 pair with the prey already sealed and riding: what the carried path is tested on. */
function carriedPair(): EngulfFixture {
  const fixture = createEngulfFixture();
  beginEngulf(fixture);
  fixture.prey.engulfProgress = DEFAULT_BALANCE.absorption.ENGULF_SEAL_PROGRESS;
  sealEngulf(fixture);
  return fixture;
}

describe('the engulf speed factor (docs/ECOLOGY.md §5.2, §6.1)', () => {
  const absorption = DEFAULT_BALANCE.absorption;
  const engulfingPair = (): EngulfFixture => {
    const fixture = createEngulfFixture();
    beginEngulf(fixture);
    return fixture;
  };

  it('is 1 for a cell that is neither engulfing nor engulfed', () => {
    const { world, cell } = placedCell(ENGULF_PREDATOR_MASS);
    expect(engulfSpeedFactor(cell, world, DEFAULT_BALANCE)).toBe(1);
  });

  it('slows the predator before the seal and frees it after (E9b)', () => {
    const { world, predator, prey } = engulfingPair();
    expect(engulfSpeedFactor(predator, world, DEFAULT_BALANCE)).toBe(absorption.ENGULF_PREDATOR_SPEED_FACTOR);
    prey.engulfProgress = absorption.ENGULF_SEAL_PROGRESS;
    expect(engulfSpeedFactor(predator, world, DEFAULT_BALANCE)).toBe(absorption.ENGULF_PREDATOR_SPEED_FACTOR_SEALED);
  });

  it('leaves the prey free in cover, holds it in wrap and stops it once sealed (E11, E11b)', () => {
    const { world, prey } = engulfingPair();
    expect(engulfSpeedFactor(prey, world, DEFAULT_BALANCE)).toBe(1);
    prey.engulfProgress = absorption.ENGULF_WRAP_START_PROGRESS;
    expect(engulfSpeedFactor(prey, world, DEFAULT_BALANCE)).toBe(absorption.ENGULF_PREY_SPEED_FACTOR);
    prey.engulfProgress = absorption.ENGULF_SEAL_PROGRESS;
    expect(engulfSpeedFactor(prey, world, DEFAULT_BALANCE)).toBe(0);
  });

  it('multiplies both halves for a cell that is predator and prey at once (a chain)', () => {
    const { world, predator, prey } = engulfingPair();
    beginEngulf({ predator: prey, prey: predator });
    prey.engulfProgress = absorption.ENGULF_WRAP_START_PROGRESS;
    expect(engulfSpeedFactor(prey, world, DEFAULT_BALANCE)).toBeCloseTo(
      absorption.ENGULF_PREY_SPEED_FACTOR * absorption.ENGULF_PREDATOR_SPEED_FACTOR,
      12,
    );
  });

  it('carries a sealed prey at its offset with the predator velocity, not the kernel (E11b)', () => {
    const { world, predator, prey } = engulfingPair();
    prey.engulfProgress = absorption.ENGULF_SEAL_PROGRESS;
    sealEngulf({ predator, prey });
    predator.targetX = predator.x - predator.radius * TARGET_RADII;
    prey.targetX = prey.x + prey.radius * TARGET_RADII;
    moveCells(world, createTestStepContext(world));
    expect(prey.x).toBeCloseTo(predator.x + ENGULF_CENTRE_DISTANCE_WU, 12);
    expect(prey.velocityX).toBe(predator.velocityX);
  });
});

describe('what a carried prey keeps doing (docs/ECOLOGY.md §6.1, §6.3)', () => {
  it('ages the sprint duration and cooldown although it never goes through the kernel', () => {
    const { world, predator, prey } = carriedPair();
    prey.sprintRemainingTicks = SPRINT_TICKS;
    prey.sprintCooldownRemainingTicks = COOLDOWN_TICKS;
    predator.sprintRemainingTicks = SPRINT_TICKS;
    const context = createTestStepContext(world);
    moveCells(world, context);
    moveCells(world, context);
    expect(prey.sprintRemainingTicks).toBe(SPRINT_TICKS - 2);
    expect(prey.sprintCooldownRemainingTicks).toBe(COOLDOWN_TICKS - 2);
    expect(prey.sprintRemainingTicks).toBe(predator.sprintRemainingTicks);
  });

  it('is clamped to the dish like any other cell, so it never rides past the rim', () => {
    const { world, predator, prey } = carriedPair();
    const reach = DEFAULT_BALANCE.world.DISH_RADIUS - predator.radius;
    predator.x = reach;
    predator.y = 0;
    predator.targetX = reach;
    predator.targetY = 0;
    moveCells(world, createTestStepContext(world));
    expect(Math.hypot(prey.x, prey.y)).toBeLessThanOrEqual(
      DEFAULT_BALANCE.world.DISH_RADIUS - prey.radius + CLAMP_TOLERANCE_WU,
    );
  });

  it('carries a chain: C rides B while B rides A (docs/ECOLOGY.md §6.3, the chain row)', () => {
    const { world, predator, prey, third } = carriedPair();
    setCellMass(third, ENGULF_PREY_MASS / 2, DEFAULT_BALANCE);
    third.x = prey.x + CHAIN_OFFSET_WU;
    third.y = prey.y;
    third.targetX = third.x;
    third.targetY = third.y;
    beginEngulf({ predator: prey, prey: third });
    sealEngulf({ predator: prey, prey: third });
    predator.targetX = predator.x - predator.radius * TARGET_RADII;
    moveCells(world, createTestStepContext(world));
    expect(prey.x).toBeCloseTo(predator.x + ENGULF_CENTRE_DISTANCE_WU, 12);
    expect(third.x).toBeCloseTo(prey.x + CHAIN_OFFSET_WU, 12);
    expect(third.velocityX).toBe(prey.velocityX);
  });
});
