// docs/GAME-DESIGN.md §5.2 and docs/ECOLOGY.md §1, §6.1 (prey row): the death seam.
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
import { refreshCellDerivedState } from '../progression/modifiers.js';
import { createTestStepContext, createTestWorld } from '../testing/builders.js';
import type { CellRecord } from '../world/entities.js';
import { absorbCell, detritusMoteCount, dissolveCell, dropDetritus } from './death.js';

const SEED = 42;
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

describe('absorbCell', () => {
  it('removes the prey, emits cell_absorbed and sets the player spectating the killer', () => {
    const { world, predator, prey, victim } = predatorAndPrey();
    world.tick = 30;
    const context = createTestStepContext(world);
    absorbCell(world, context, prey, predator);
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
      },
    ]);
    expect(victim.lifeState).toBe(PLAYER_LIFE_STATE.spectating);
    expect(victim.spectatingPlayerId).toBe('a');
    expect(victim.respawnInTicks).toBe(secondsToTicks(session.RESPAWN_SPECTATE_SECONDS));
    expect(world.food.every((mote) => mote.kind === FOOD_KIND.detritus)).toBe(true);
    expect(world.food).toHaveLength(2);
  });

  it('keeps level, traits and the kept share of the progress (nuclear envelope II keeps 50 %)', () => {
    const { world, predator, prey, victim } = predatorAndPrey();
    victim.level = 5;
    victim.dnaTowardNextLevel = 40;
    victim.ownedTraits.push({ traitId: 'nucleoid', tier: 1 }, { traitId: 'nuclear_envelope', tier: 2 });
    refreshCellDerivedState(prey, victim, DEFAULT_BALANCE);
    absorbCell(world, createTestStepContext(world), prey, predator);
    expect(victim.dnaTowardNextLevel).toBe(20);
    expect(victim.level).toBe(5);
    expect(victim.ownedTraits).toHaveLength(2);
  });

  it('loses the whole progress without a nuclear envelope', () => {
    const { world, predator, prey, victim } = predatorAndPrey();
    victim.dnaTowardNextLevel = 40;
    absorbCell(world, createTestStepContext(world), prey, predator);
    expect(victim.dnaTowardNextLevel).toBe(0);
  });
});
