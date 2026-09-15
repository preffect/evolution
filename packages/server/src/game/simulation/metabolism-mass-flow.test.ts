// docs/ui/hud.md §3.1.5 "Applied, at the floor and the cap" (#383, #420): what the metabolism step records of each
// player cell's mass flow, from the formula's own factors. The mass arithmetic itself is `metabolism.test.ts`.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, TICK_INTERVAL_S, playerId, type Vec2 } from '@evolution/shared';
import { BROTH_POINT, VENT_POINT } from '../../testing/gameplay/placement.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { refreshCellDerivedState } from '../progression/modifiers.js';
import type { CellRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';
import { setCellMass } from './cell-mass.js';
import { metabolise } from './metabolism.js';

const { growth, ecology } = DEFAULT_BALANCE;
/** #383's worked example: mass 312 touched, 10 wu apart, by a 96-mass Toxin Vacuole I cell; rates to 1e-9. */
const TOUCHING_OFFSET_WU = 10;
const WORKED_MASS = 312;
const TOXIC_MASS = 96;
const RATE_DIGITS = 9;

function metaboliseOnce(world: WorldState): void {
  metabolise(world, createTestStepContext(world));
}

/** One player cell of `mass` at `centre`, nothing else in the dish. */
function soloCell(mass: number, centre: Vec2) {
  const world = createTestWorld();
  const cell = world.cells[0]!;
  Object.assign(cell, { x: centre.x, y: centre.y });
  setCellMass(cell, mass, DEFAULT_BALANCE);
  return { world, cell, player: world.players[0]! };
}

describe('metabolise: the applied mass flow (#383, docs/ui/hud.md §3.1.5)', () => {
  const tiers = DEFAULT_BALANCE.traits.TRAIT_TIERS;

  /** Mass `mass` at `centre` owning `ownTrait`, touched by a Toxin Vacuole I cell of `TOXIC_MASS`. */
  function touchedByToxin(mass: number, centre: Vec2, ownTrait?: 'mitochondrion') {
    const world = createTestWorld({
      players: [
        { playerId: playerId('a'), playerName: 'A', avatarIndex: 0 },
        { playerId: playerId('b'), playerName: 'B', avatarIndex: 1 },
      ],
    });
    const [own, toxic] = world.cells as [CellRecord, CellRecord];
    const [ownPlayer, toxicPlayer] = world.players as [(typeof world.players)[0], (typeof world.players)[0]];
    Object.assign(own, { x: centre.x, y: centre.y });
    Object.assign(toxic, { x: centre.x + TOUCHING_OFFSET_WU, y: centre.y });
    setCellMass(own, mass, DEFAULT_BALANCE);
    setCellMass(toxic, TOXIC_MASS, DEFAULT_BALANCE);
    if (ownTrait !== undefined) ownPlayer.ownedTraits.push({ traitId: ownTrait, tier: 1 });
    toxicPlayer.ownedTraits.push({ traitId: 'toxin_vacuole', tier: 1 });
    refreshCellDerivedState(own, ownPlayer, DEFAULT_BALANCE);
    refreshCellDerivedState(toxic, toxicPlayer, DEFAULT_BALANCE);
    return { world, own, ownPlayer };
  }

  it('the worked example: mass 312 in the vent with Mitochondrion I, touching Toxin Vacuole I', () => {
    const { world, own, ownPlayer } = touchedByToxin(WORKED_MASS, VENT_POINT, 'mitochondrion');
    metaboliseOnce(world);
    const record = world.massFlow.metabolismByPlayer[ownPlayer.playerId]!;
    const traitDecay = tiers.mitochondrion[0]!.decayMultiplier!;
    const brothDecay = (WORKED_MASS - growth.CELL_STARTING_MASS) * ecology.MASS_DECAY_RATE_PER_SECOND * traitDecay;
    expect(record.zone).toBe('warm_vent');
    expect(record.ratesPerSecond.toxin).toBeCloseTo(
      -WORKED_MASS * tiers.toxin_vacuole[0]!.toxinDrainFractionPerSecond!,
      RATE_DIGITS,
    );
    expect(record.ratesPerSecond.decay).toBeCloseTo(-brothDecay, RATE_DIGITS);
    expect(record.ratesPerSecond.vent).toBeCloseTo(-brothDecay * (ecology.VENT_DECAY_MULTIPLIER - 1), RATE_DIGITS);
    expect(record.ratesPerSecond.swallowed).toBe(-0);
    expect(record.ratesPerSecond.light).toBe(0);
    expect(record.decayTraitShare).toBeCloseTo(traitDecay - 1, RATE_DIGITS);
    const applied = Object.values(record.ratesPerSecond).reduce((sum, rate) => sum + rate, 0) * TICK_INTERVAL_S;
    expect(own.mass - WORKED_MASS).toBeCloseTo(applied, RATE_DIGITS);
  });

  it('at the floor reports what was taken, split in proportion, never the formula', () => {
    const surplus = 0.01;
    const { world, own, ownPlayer } = touchedByToxin(growth.CELL_STARTING_MASS + surplus, BROTH_POINT);
    metaboliseOnce(world);
    const rates = world.massFlow.metabolismByPlayer[ownPlayer.playerId]!.ratesPerSecond;
    expect(own.mass).toBe(growth.CELL_STARTING_MASS);
    expect((rates.toxin + rates.decay) * TICK_INTERVAL_S).toBeCloseTo(-surplus, RATE_DIGITS);
    const toxinFormula = (growth.CELL_STARTING_MASS + surplus) * tiers.toxin_vacuole[0]!.toxinDrainFractionPerSecond!;
    expect(-rates.toxin).toBeLessThan(toxinFormula);
  });

  it('records no flow for a cell with no player', () => {
    const { world, cell, player } = soloCell(WORKED_MASS, BROTH_POINT);
    cell.playerId = null;
    metaboliseOnce(world);
    expect(world.massFlow.metabolismByPlayer[player.playerId]).toBeUndefined();
  });
});

describe('metabolise: the vent share from its own factors (#420)', () => {
  it('reports finite rates when a balance patch sets VENT_DECAY_MULTIPLIER to 0', () => {
    const { world, player } = soloCell(WORKED_MASS, VENT_POINT);
    world.balance = structuredClone(DEFAULT_BALANCE);
    world.balance.ecology.VENT_DECAY_MULTIPLIER = 0;
    metaboliseOnce(world);
    const rates = world.massFlow.metabolismByPlayer[player.playerId]!.ratesPerSecond;
    expect(Object.values(rates).every(Number.isFinite)).toBe(true);
  });

  it('splits the vent decay into the broth share and its extra, each from the formula', () => {
    const { world, cell, player } = soloCell(WORKED_MASS, VENT_POINT);
    metaboliseOnce(world);
    const rates = world.massFlow.metabolismByPlayer[player.playerId]!.ratesPerSecond;
    const brothDecay = (WORKED_MASS - growth.CELL_STARTING_MASS) * ecology.MASS_DECAY_RATE_PER_SECOND;
    expect(rates.decay).toBeCloseTo(-brothDecay, RATE_DIGITS);
    expect(rates.vent).toBeCloseTo(-brothDecay * (ecology.VENT_DECAY_MULTIPLIER - 1), RATE_DIGITS);
    expect((rates.decay + rates.vent) * TICK_INTERVAL_S).toBeCloseTo(cell.mass - WORKED_MASS, RATE_DIGITS);
  });
});
