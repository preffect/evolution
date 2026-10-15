// docs/game-design/phases.md §14.4.2, steps 1, 3, 4, 5 and 8 of the pool's move (the others belong to tickets #869,
// #870, #872 and the serializer): what cannot cross ends with nothing paid, the dish's wild cells, giants, motes and
// spawners leave (each cell a green speck at its mapped point), each player lands at its mapped point at the arrival
// mass with its velocity and target scaled, and the grace starts on the move's tick.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  DNA_TAG,
  EFFECT_KIND,
  ENGULF_RELEASE_REASON,
  FOOD_KIND,
  GIANT_SPECIES,
  secondsToTicks,
} from '@evolution/shared';
import { createEngulfFixture } from '../../testing/engulf-builders.js';
import { seatTestGiantCell, seatTestWildCell } from '../../testing/wild-builders.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import type { BacteriumMoteRecord, CellRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';
import { setCellMass } from './cell-mass.js';
import { beginEngulf } from './engulf-state.js';
import { spawnDnaFragment, spawnFoodMote } from './spawn-mote.js';
import { mapDishPointToPool, runPoolMove } from './pool-move.js';

const { eras, pool } = DEFAULT_BALANCE;
/** PH1: the player at (1 200, −600), mass 500, lands at (120, −60). */
const PH1_DISH_POINT = { x: 1200, y: -600 };
const PH1_POOL_POINT = { x: 120, y: -60 };
const PH1_MASS = 500;
const DISH_VELOCITY = { x: 50, y: -20 };
const DISH_TARGET = { x: 1500, y: -900 };
/** A fixture's pin in dish units: left there, it would drag the cell back outside the 300 wu footprint. */
const DISH_PIN = { x: -1100, y: 700 };
const MOVE_TICK = 36_000;
const SPRINT_TICKS = 30;
const SPRINT_COOLDOWN_TICKS = 120;
const WILD_AT = { x: -800, y: 400 };
const GIANT_AT = { x: 900, y: 900 };
const MOTE_AT = { x: 100, y: 100 };
const DRIFT_TURN = 0.25;
const HELD_BEARING_RADIANS = 1;

function placePh1Cell(cell: CellRecord): void {
  cell.x = PH1_DISH_POINT.x;
  cell.y = PH1_DISH_POINT.y;
  cell.velocityX = DISH_VELOCITY.x;
  cell.velocityY = DISH_VELOCITY.y;
  cell.targetX = DISH_TARGET.x;
  cell.targetY = DISH_TARGET.y;
  setCellMass(cell, PH1_MASS, DEFAULT_BALANCE);
}

describe('mapDishPointToPool (step 3)', () => {
  it('divides a dish point by ERA_SCALE_STEP: the dish maps onto a disc at the pool’s centre', () => {
    expect(mapDishPointToPool(PH1_DISH_POINT, DEFAULT_BALANCE)).toEqual(PH1_POOL_POINT);
    expect(mapDishPointToPool({ x: DEFAULT_BALANCE.world.DISH_RADIUS, y: 0 }, DEFAULT_BALANCE).x).toBe(
      DEFAULT_BALANCE.world.DISH_RADIUS / eras.ERA_SCALE_STEP,
    );
  });
});

describe('runPoolMove', () => {
  it('step 1: ends an engulf with no transfer, both cells free, and ends every sprint and held list', () => {
    const { world, context, predator, prey } = createEngulfFixture();
    beginEngulf({ predator, prey });
    predator.sprintRemainingTicks = SPRINT_TICKS;
    predator.sprintCooldownRemainingTicks = SPRINT_COOLDOWN_TICKS;
    holdOneBacterium(world, predator);
    runPoolMove(world, context);
    expect(predator.engulfingCellId).toBeNull();
    expect(prey.engulfedByCellId).toBeNull();
    expect(predator.mass).toBe(pool.POOL_ARRIVAL_MASS);
    const released = world.effects.filter((effect) => effect.kind === EFFECT_KIND.cellReleased);
    expect(released).toMatchObject([{ cellId: prey.id, reason: ENGULF_RELEASE_REASON.aborted }]);
    expect(world.effects.some((effect) => effect.kind === EFFECT_KIND.cellAbsorbed)).toBe(false);
    expect(predator.sprintRemainingTicks).toBe(0);
    expect(predator.sprintCooldownRemainingTicks).toBe(SPRINT_COOLDOWN_TICKS);
    expect(predator.latchedBacteria).toEqual([]);
  });

  it('step 4: the dish’s wild cells, giants, motes and fragments leave, their seats empty, the spawners stop', () => {
    const world = createTestWorld();
    seatTestWildCell(world, { at: WILD_AT });
    seatTestGiantCell(world, { species: GIANT_SPECIES.amoeba, at: GIANT_AT, bornMass: PH1_MASS });
    spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: MOTE_AT });
    spawnDnaFragment(world, { at: MOTE_AT, tag: DNA_TAG.motile, driftTurn: DRIFT_TURN });
    world.spawners.food.isEnabled = true;
    world.spawners.dnaFragments.isEnabled = true;
    runPoolMove(world, createTestStepContext(world));
    expect(world.cells.map((cell) => cell.playerId)).toEqual([world.players[0]!.playerId]);
    expect(world.wildSeats).toEqual([]);
    expect(world.giantSeats).toEqual([]);
    expect(world.food.map((mote) => mote.kind)).toEqual([FOOD_KIND.greenSpeck, FOOD_KIND.greenSpeck]);
    expect(world.dnaFragments).toEqual([]);
    expect(world.spawners.food.isEnabled).toBe(false);
    expect(world.spawners.dnaFragments.isEnabled).toBe(false);
  });

  it('step 4: each wild cell and giant leaves one green speck of ERA_LEFTOVER_SPECK_MASS at its mapped point', () => {
    const world = createTestWorld();
    seatTestWildCell(world, { at: WILD_AT });
    seatTestGiantCell(world, { species: GIANT_SPECIES.amoeba, at: GIANT_AT, bornMass: PH1_MASS });
    runPoolMove(world, createTestStepContext(world));
    expect(eras.ERA_LEFTOVER_SPECK_MASS).not.toBe(pool.POOL_GREEN_SPECK_MASS);
    expect(world.food).toMatchObject([
      {
        kind: FOOD_KIND.greenSpeck,
        mass: eras.ERA_LEFTOVER_SPECK_MASS,
        ...mapDishPointToPool(WILD_AT, DEFAULT_BALANCE),
      },
      {
        kind: FOOD_KIND.greenSpeck,
        mass: eras.ERA_LEFTOVER_SPECK_MASS,
        ...mapDishPointToPool(GIANT_AT, DEFAULT_BALANCE),
      },
    ]);
  });

  it('step 4: a dish with no wild cell or giant leaves no speck', () => {
    const world = createTestWorld();
    runPoolMove(world, createTestStepContext(world));
    expect(world.food).toEqual([]);
  });

  it('step 4: a player spectating a wild cell no longer follows it once it has left', () => {
    const world = createTestWorld();
    const { cell: killer } = seatTestWildCell(world, { at: WILD_AT });
    world.players[0]!.spectatingCellId = killer.id;
    runPoolMove(world, createTestStepContext(world));
    expect(world.players[0]!.spectatingCellId).toBeNull();
  });

  it('step 5 (PH1): the cell lands at its mapped point at POOL_ARRIVAL_MASS, velocity and target scaled', () => {
    const world = createTestWorld();
    const cell = world.cells[0]!;
    placePh1Cell(cell);
    runPoolMove(world, createTestStepContext(world));
    expect({ x: cell.x, y: cell.y }).toEqual(PH1_POOL_POINT);
    expect(cell.mass).toBe(pool.POOL_ARRIVAL_MASS);
    expect(cell.radius).toBeLessThan(world.balance.world.DISH_RADIUS);
    expect({ x: cell.velocityX, y: cell.velocityY }).toEqual({
      x: DISH_VELOCITY.x / eras.ERA_SCALE_STEP,
      y: DISH_VELOCITY.y / eras.ERA_SCALE_STEP,
    });
    expect({ x: cell.targetX, y: cell.targetY }).toEqual(mapDishPointToPool(DISH_TARGET, DEFAULT_BALANCE));
  });

  it('step 5: a fixture’s pin maps into the pool with its cell', () => {
    const world = createTestWorld();
    const cell = world.cells[0]!;
    cell.pinnedX = DISH_PIN.x;
    cell.pinnedY = DISH_PIN.y;
    runPoolMove(world, createTestStepContext(world));
    expect({ x: cell.pinnedX, y: cell.pinnedY }).toEqual(mapDishPointToPool(DISH_PIN, DEFAULT_BALANCE));
  });

  it('step 5: a cell with no target or pin keeps none', () => {
    const world = createTestWorld();
    const cell = world.cells[0]!;
    cell.targetX = null;
    cell.targetY = null;
    runPoolMove(world, createTestStepContext(world));
    expect([cell.targetX, cell.targetY, cell.pinnedX, cell.pinnedY]).toEqual([null, null, null, null]);
  });

  it('step 8: the grace starts on the move’s tick, stored on the world', () => {
    const world = createTestWorld();
    world.tick = MOVE_TICK;
    runPoolMove(world, createTestStepContext(world));
    expect(world.moveGraceEndsAtTick).toBe(MOVE_TICK + secondsToTicks(eras.ERA_MOVE_GRACE_SECONDS));
  });
});

/** A bacterium in the cell's held list, as the latch would leave it (early-life.md §15.4.2). */
function holdOneBacterium(world: WorldState, cell: CellRecord): void {
  const mote = spawnFoodMote(world, { kind: FOOD_KIND.bacterium, variant: 'aerobic', at: MOTE_AT });
  cell.latchedBacteria.push({
    mote: mote as BacteriumMoteRecord,
    bearingRadians: HELD_BEARING_RADIANS,
    caughtAtTick: world.tick,
  });
}
