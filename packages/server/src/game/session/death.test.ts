// docs/game-design/session.md §5.2 and docs/ecology/food-and-spawn.md §1, docs/ecology/absorption.md §6.1 (prey row): the death seam.
import { describe, expect, it } from 'vitest';
import {
  createSeededRandom,
  DEFAULT_BALANCE,
  EFFECT_KIND,
  FOOD_KIND,
  PLAYER_LIFE_STATE,
  playerId,
  secondsToTicks,
} from '@evolution/shared';
import { setCellMass } from '../simulation/cell-mass.js';
import { beginEngulf } from '../simulation/engulf-state.js';
import { refreshCellDerivedState } from '../progression/modifiers.js';
import { seatTestWildCell } from '../../testing/wild-builders.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import type { CellRecord } from '../world/entities.js';
import { NO_GAIN } from '../simulation/cell-mass.js';
import { absorbCell, detritusMoteCount, dissolveCell, dropDetritus, withdrawCell } from './death.js';

const SEED = 42;
/** The projection onto the food boundary lands on it up to float rounding; a stray mote overshoots by tens of wu. */
const PROJECTION_ROUNDING_WU = 1e-9;
const { ecology, session } = DEFAULT_BALANCE;

function predatorAndPrey() {
  const world = createTestWorld({
    players: [
      { playerId: playerId('a'), playerName: 'A', avatarIndex: 0 },
      { playerId: playerId('b'), playerName: 'B', avatarIndex: 1 },
    ],
  });
  const [predator, prey] = world.cells as [CellRecord, CellRecord];
  setCellMass(predator, 100, DEFAULT_BALANCE);
  return { world, predator, prey, killer: world.players[0]!, victim: world.players[1]! };
}

describe('detritusMoteCount', () => {
  it('floors the fraction of the mass into motes (a 23-mass cell drops two)', () => {
    const world = createTestWorld();
    expect(detritusMoteCount(23, world)).toBe(2);
    expect(detritusMoteCount(20, world)).toBe(2);
    expect(detritusMoteCount(9, world)).toBe(0);
    expect(detritusMoteCount(100, world)).toBe(
      Math.floor((ecology.DETRITUS_MASS_FRACTION * 100) / ecology.DETRITUS_MOTE_MASS),
    );
  });
});

describe('dropDetritus', () => {
  it('scatters detritus motes of DETRITUS_MOTE_MASS within two radii of the cell', () => {
    const world = createTestWorld();
    const cell = world.cells[0]!;
    setCellMass(cell, 100, DEFAULT_BALANCE);
    dropDetritus(world, cell, createSeededRandom(SEED));
    expect(world.food).toHaveLength(10);
    for (const mote of world.food) {
      expect(mote.kind).toBe(FOOD_KIND.detritus);
      expect(mote.mass).toBe(ecology.DETRITUS_MOTE_MASS);
      expect(Math.hypot(mote.x - cell.x, mote.y - cell.y)).toBeLessThanOrEqual(2 * cell.radius);
      expect(mote.expiresAtTick).toBe(world.tick + secondsToTicks(ecology.DETRITUS_LIFETIME_SECONDS));
    }
  });

  it('keeps every mote of a cell dying at the wall inside the food edge margin (#638)', () => {
    const world = createTestWorld();
    const cell = world.cells[0]!;
    setCellMass(cell, 400, DEFAULT_BALANCE);
    cell.x = DEFAULT_BALANCE.world.DISH_RADIUS - cell.radius;
    cell.y = 0;
    dropDetritus(world, cell, createSeededRandom(SEED));
    expect(world.food.length).toBeGreaterThan(0);
    const foodReach = DEFAULT_BALANCE.world.DISH_RADIUS - DEFAULT_BALANCE.world.FOOD_EDGE_MARGIN;
    for (const mote of world.food) {
      expect(Math.hypot(mote.x, mote.y)).toBeLessThanOrEqual(foodReach + PROJECTION_ROUNDING_WU);
    }
  });
});

describe('dissolveCell', () => {
  it('removes the cell and drops its detritus, keeping the player record', () => {
    const world = createTestWorld();
    const cell = world.cells[0]!;
    dissolveCell(world, cell, createSeededRandom(SEED));
    expect(world.cells).toEqual([]);
    expect(world.players).toHaveLength(1);
    expect(world.food.reduce((sum, mote) => sum + mote.mass, 0)).toBe(4);
  });
});

describe('withdrawCell', () => {
  it('removes the cell without detritus, aborting its engulf and forgetting it as a spectated cell', () => {
    const { world, predator, prey, victim } = predatorAndPrey();
    beginEngulf({ predator, prey });
    victim.spectatingCellId = predator.id;
    withdrawCell(world, predator);
    expect(world.cells).toEqual([prey]);
    expect(world.food).toEqual([]);
    expect(prey.engulfedByCellId).toBeNull();
    expect(world.effects.map((effect) => effect.kind)).toEqual([EFFECT_KIND.cellReleased]);
    expect(victim.spectatingCellId).toBeNull();
  });
});

describe('absorbCell', () => {
  it('removes the prey, emits cell_absorbed and sets the player spectating the killer', () => {
    const { world, predator, prey, victim } = predatorAndPrey();
    world.tick = 30;
    const context = createTestStepContext(world);
    absorbCell(world, context, { prey, predator, predatorGain: NO_GAIN });
    expect(world.cells).toEqual([predator]);
    expect(context.effects).toEqual([
      {
        kind: EFFECT_KIND.cellAbsorbed,
        tick: 30,
        x: prey.x,
        y: prey.y,
        cellId: prey.id,
        playerId: 'b',
        predatorCellId: predator.id,
        predatorMassGained: NO_GAIN.massGained,
        predatorDnaGained: NO_GAIN.dnaGained,
      },
    ]);
    expect(victim.lifeState).toBe(PLAYER_LIFE_STATE.spectating);
    expect(victim.spectatingCellId).toBe(predator.id);
    // The death tick is spectated too (#211): the countdown runs at step 9 of this same tick.
    expect(victim.respawnInTicks).toBe(secondsToTicks(session.RESPAWN_SPECTATE_SECONDS) + 1);
    expect(world.food.every((mote) => mote.kind === FOOD_KIND.detritus)).toBe(true);
    expect(world.food).toHaveLength(2);
  });

  it('keeps level, traits and the kept share of the progress (nuclear envelope II keeps 50 %)', () => {
    const { world, predator, prey, victim } = predatorAndPrey();
    victim.level = 5;
    victim.dnaTowardNextLevel = 40;
    victim.ownedTraits.push({ traitId: 'nucleoid', tier: 1 }, { traitId: 'nuclear_envelope', tier: 2 });
    refreshCellDerivedState(prey, victim, DEFAULT_BALANCE);
    absorbCell(world, createTestStepContext(world), { prey, predator, predatorGain: NO_GAIN });
    expect(victim.dnaTowardNextLevel).toBe(20);
    expect(victim.level).toBe(5);
    expect(victim.ownedTraits).toHaveLength(2);
  });

  it('loses the whole progress without a nuclear envelope', () => {
    const { world, predator, prey, victim } = predatorAndPrey();
    victim.dnaTowardNextLevel = 40;
    absorbCell(world, createTestStepContext(world), { prey, predator, predatorGain: NO_GAIN });
    expect(victim.dnaTowardNextLevel).toBe(0);
  });

  it('emits cell_absorbed with playerId null for a wild prey and sets nobody spectating (#270)', () => {
    const { world, predator, killer, victim } = predatorAndPrey();
    const { cell: prey } = seatTestWildCell(world, { at: { x: predator.x + 10, y: predator.y }, mass: 20 });
    world.tick = 30;
    const context = createTestStepContext(world);
    absorbCell(world, context, { prey, predator, predatorGain: NO_GAIN });
    expect(world.cells).not.toContain(prey);
    expect(context.effects).toEqual([
      expect.objectContaining({
        kind: EFFECT_KIND.cellAbsorbed,
        tick: 30,
        cellId: prey.id,
        playerId: null,
        predatorCellId: predator.id,
      }),
    ]);
    expect(world.food).toHaveLength(2);
    for (const player of [killer, victim]) {
      expect(player.lifeState).toBe(PLAYER_LIFE_STATE.alive);
      expect(player.respawnInTicks).toBe(0);
    }
  });
});
