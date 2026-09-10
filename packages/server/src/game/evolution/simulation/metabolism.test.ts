// docs/ECOLOGY.md §4, §4.1 (E5) and docs/TRAITS.md §6 (T5, T7).
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, playerId, type Vec2 } from '@evolution/shared';
import { createDecayedHelper } from '../../../testing/gameplay/fixtures.js';
import { BROTH_POINT, shallowsPoint, VENT_POINT } from '../../../testing/gameplay/placement.js';
import { refreshCellDerivedState } from '../progression/modifiers.js';
import { createTestStepContext, createTestWorld } from '../testing/builders.js';
import type { CellRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';
import { setCellMass } from './cell-mass.js';
import { decayPerSecond, isReachedByToxin, metabolise, toxinDrainFraction } from './metabolism.js';

const { growth, ecology, world: worldBalance } = DEFAULT_BALANCE;
const decayed = createDecayedHelper({
  cellStartingMass: growth.CELL_STARTING_MASS,
  massDecayRatePerSecond: ecology.MASS_DECAY_RATE_PER_SECOND,
});

function placedCell(mass: number, centre: Vec2 = BROTH_POINT, traitId?: 'chloroplast' | 'toxin_vacuole') {
  const world = createTestWorld();
  const cell = world.cells[0]!;
  cell.x = centre.x;
  cell.y = centre.y;
  setCellMass(cell, mass, DEFAULT_BALANCE);
  if (traitId !== undefined) {
    world.players[0]!.ownedTraits.push({ traitId, tier: 1 });
    refreshCellDerivedState(cell, world.players[0]!, DEFAULT_BALANCE);
  }
  return { world, cell };
}

function metaboliseFor(world: WorldState, ticks: number): void {
  const context = createTestStepContext(world);
  for (let tick = 0; tick < ticks; tick += 1) metabolise(world, context);
}

describe('metabolise', () => {
  it('E5: mass 1020 in the broth decays to decayed(1020, 60) ≈ 1018.00 after 60 ticks', () => {
    const { world, cell } = placedCell(1020);
    metaboliseFor(world, 60);
    expect(cell.mass).toBeCloseTo(decayed(1020, 60), 2);
    expect(Math.abs(cell.mass - 1018)).toBeLessThan(0.01);
  });

  it('E5: in the vent the decay multiplier is 1.5 (≈ 1017.00)', () => {
    const { world, cell } = placedCell(1020, VENT_POINT);
    metaboliseFor(world, 60);
    expect(cell.mass).toBeCloseTo(decayed(1020, 60, ecology.VENT_DECAY_MULTIPLIER), 2);
    expect(Math.abs(cell.mass - 1017)).toBeLessThan(0.01);
  });

  it('never drops a cell below the starting mass', () => {
    const { world, cell } = placedCell(growth.CELL_STARTING_MASS);
    metaboliseFor(world, 600);
    expect(cell.mass).toBe(growth.CELL_STARTING_MASS);
    expect(decayPerSecond({ cell, massAtStart: cell.mass, zone: 'open_broth' }, DEFAULT_BALANCE)).toBe(0);
  });

  it('T5: chloroplast I gains 0.3 mass/s in the shallows minus the decay of the growing surplus', () => {
    const shallows = shallowsPoint(worldBalance.DISH_RADIUS, ecology.SHALLOWS_WIDTH);
    const { world, cell } = placedCell(growth.CELL_STARTING_MASS, shallows, 'chloroplast');
    metaboliseFor(world, 60);
    expect(Math.abs(cell.mass - 20.2997)).toBeLessThan(0.001);
    const broth = placedCell(growth.CELL_STARTING_MASS, BROTH_POINT, 'chloroplast');
    metaboliseFor(broth.world, 60);
    expect(broth.cell.mass).toBe(growth.CELL_STARTING_MASS);
  });

  it('T7: a toxin vacuole I drains an overlapping 90-mass cell to ≈ 87.20 in 60 ticks, itself only decaying', () => {
    const world = createTestWorld({
      players: [
        { playerId: playerId('b'), playerName: 'B', avatarIndex: 0 },
        { playerId: playerId('c'), playerName: 'C', avatarIndex: 1 },
      ],
    });
    const [toxic, victim] = world.cells as [CellRecord, CellRecord];
    toxic.x = BROTH_POINT.x;
    toxic.y = BROTH_POINT.y;
    victim.x = BROTH_POINT.x + 10;
    victim.y = BROTH_POINT.y;
    setCellMass(toxic, 100, DEFAULT_BALANCE);
    setCellMass(victim, 90, DEFAULT_BALANCE);
    world.players[0]!.ownedTraits.push({ traitId: 'toxin_vacuole', tier: 1 });
    refreshCellDerivedState(toxic, world.players[0]!, DEFAULT_BALANCE);
    metaboliseFor(world, 60);
    expect(Math.abs(victim.mass - 87.2)).toBeLessThan(0.01);
    expect(toxic.mass).toBeCloseTo(decayed(100, 60), 2);
  });

  it('reads the start-of-step masses so the pair terms do not depend on array order', () => {
    const build = (order: 'toxicFirst' | 'victimFirst') => {
      const world = createTestWorld({
        players: [
          { playerId: playerId('b'), playerName: 'B', avatarIndex: 0 },
          { playerId: playerId('c'), playerName: 'C', avatarIndex: 1 },
        ],
      });
      const [toxic, victim] = world.cells as [CellRecord, CellRecord];
      for (const cell of [toxic, victim]) {
        cell.x = BROTH_POINT.x;
        cell.y = BROTH_POINT.y;
        setCellMass(cell, 100, DEFAULT_BALANCE);
        cell.modifiers.toxinDrainFractionPerSecond = 0.05;
      }
      if (order === 'victimFirst') world.cells = [victim, toxic];
      metaboliseFor(world, 30);
      return [toxic.mass, victim.mass];
    };
    const [firstA, firstB] = build('toxicFirst');
    const [secondA, secondB] = build('victimFirst');
    expect(firstA).toBe(secondA);
    expect(firstB).toBe(secondB);
    expect(firstA).toBe(firstB);
  });
});

describe('toxin reach', () => {
  it('reaches by overlap, or by the aura range without contact', () => {
    const { world, cell: toxic } = placedCell(100);
    const target = { ...toxic, id: 'c-99', x: toxic.x + toxic.radius + 30, radius: 10 } as CellRecord;
    expect(isReachedByToxin(target, toxic)).toBe(false);
    toxic.modifiers.toxinAuraRangeInRadii = 2;
    expect(isReachedByToxin(target, toxic)).toBe(true);
    toxic.modifiers.toxinDrainFractionPerSecond = 0.03;
    expect(toxinDrainFraction(target, [toxic, target])).toBe(0.03);
    expect(toxinDrainFraction(toxic, world.cells)).toBe(0);
  });
});
