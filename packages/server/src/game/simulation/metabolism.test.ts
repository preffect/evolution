// docs/ecology/mass-and-movement.md §4, §4.1 (E5), §5.4 and docs/traits/constants-and-acceptance.md §6 (T5, T7).
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, TICK_INTERVAL_S, playerId, type TraitTier, type Vec2 } from '@evolution/shared';
import { createDecayedHelper } from '../../testing/gameplay/fixtures.js';
import { BROTH_POINT, shallowsPoint, VENT_POINT } from '../../testing/gameplay/placement.js';
import { refreshCellDerivedState } from '../progression/modifiers.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import type { CellRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';
import { setCellMass } from './cell-mass.js';
import { decayPerSecond, isReachedByToxin, metabolise, metabolismInputOf, toxinDrainFraction } from './metabolism.js';

const { growth, ecology, world: worldBalance } = DEFAULT_BALANCE;
const decayed = createDecayedHelper({
  cellStartingMass: growth.CELL_STARTING_MASS,
  massDecayRatePerSecond: ecology.MASS_DECAY_RATE_PER_SECOND,
});

/** T5 at the cap: Chloroplast III, the highest tier (docs/traits/catalog-organelles.md). */
const CHLOROPLAST_TOP_TIER: TraitTier = 3;
/** T5 at the cap: "± 1e-9" on the overflow DNA. */
const OVERFLOW_DNA_DIGITS = 9;

/** #383's worked example: mass 312 touched, 10 wu apart, by a 96-mass Toxin Vacuole I cell; rates to 1e-9. */
const TOUCHING_OFFSET_WU = 10;
const WORKED_MASS = 312;
const TOXIC_MASS = 96;
const RATE_DIGITS = 9;

function placedCell(
  mass: number,
  centre: Vec2 = BROTH_POINT,
  traitId?: 'chloroplast' | 'toxin_vacuole',
  tier: TraitTier = 1,
) {
  const world = createTestWorld();
  const cell = world.cells[0]!;
  cell.x = centre.x;
  cell.y = centre.y;
  setCellMass(cell, mass, DEFAULT_BALANCE);
  if (traitId !== undefined) {
    world.players[0]!.ownedTraits.push({ traitId, tier });
    refreshCellDerivedState(cell, world.players[0]!, DEFAULT_BALANCE);
  }
  return { world, cell, player: world.players[0]! };
}

/** Chloroplast III in the shallows at `mass`, on a balance copy whose decay rate is `decayRatePerSecond`. */
function topChloroplastInShallows(mass: number, decayRatePerSecond = ecology.MASS_DECAY_RATE_PER_SECOND) {
  const shallows = shallowsPoint(worldBalance.DISH_RADIUS, ecology.SHALLOWS_WIDTH);
  const placed = placedCell(mass, shallows, 'chloroplast', CHLOROPLAST_TOP_TIER);
  placed.world.balance = structuredClone(DEFAULT_BALANCE);
  placed.world.balance.ecology.MASS_DECAY_RATE_PER_SECOND = decayRatePerSecond;
  return placed;
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
    expect(decayPerSecond(metabolismInputOf(cell, world, DEFAULT_BALANCE), DEFAULT_BALANCE)).toBe(0);
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

  it('T5 at the cap: with decay patched to 0, Chloroplast III at CELL_MAX_MASS holds the cap and banks the light as DNA', () => {
    const { world, cell, player } = topChloroplastInShallows(growth.CELL_MAX_MASS, 0);
    // Nucleoid Coil raises the DNA multiplier above 1, so the expectation can only pass with the factor applied.
    player.ownedTraits.push({ traitId: 'nucleoid', tier: 1 });
    refreshCellDerivedState(cell, player, world.balance);
    expect(cell.modifiers.dnaGainMultiplier).toBeGreaterThan(1);
    const lightPerTick = cell.modifiers.photosynthesisMassPerSecond * TICK_INTERVAL_S;
    expect(lightPerTick).toBeGreaterThan(0);
    metaboliseFor(world, 1);
    expect(cell.mass).toBe(growth.CELL_MAX_MASS);
    const expectedDna = lightPerTick * growth.MASS_OVERFLOW_DNA_PER_MASS * cell.modifiers.dnaGainMultiplier;
    expect(player.dnaCumulative).toBeCloseTo(expectedDna, OVERFLOW_DNA_DIGITS);
    expect(player.dnaTowardNextLevel).toBeCloseTo(expectedDna, OVERFLOW_DNA_DIGITS);
  });

  it('T5 at the cap: the same cell with no player (wild) is clamped to CELL_MAX_MASS with no DNA', () => {
    const { world, cell, player } = topChloroplastInShallows(growth.CELL_MAX_MASS, 0);
    cell.playerId = null;
    metaboliseFor(world, 1);
    expect(cell.mass).toBe(growth.CELL_MAX_MASS);
    expect(player.dnaCumulative).toBe(0);
  });

  it('T5: below the cap the light gain is unchanged and grants no DNA', () => {
    const { world, cell, player } = topChloroplastInShallows(growth.CELL_STARTING_MASS);
    metaboliseFor(world, 1);
    expect(cell.mass).toBe(growth.CELL_STARTING_MASS + cell.modifiers.photosynthesisMassPerSecond * TICK_INTERVAL_S);
    expect(player.dnaCumulative).toBe(0);
  });

  it('T5: at the default balance Chloroplast III above its light plateau loses mass in the shallows', () => {
    const { world, cell, player } = topChloroplastInShallows(growth.CELL_STARTING_MASS);
    const plateau =
      growth.CELL_STARTING_MASS +
      cell.modifiers.photosynthesisMassPerSecond /
        (ecology.MASS_DECAY_RATE_PER_SECOND * cell.modifiers.decayMultiplier);
    const aboveThePlateau = Math.ceil(plateau);
    expect(aboveThePlateau).toBeLessThan(growth.CELL_MAX_MASS);
    setCellMass(cell, aboveThePlateau, world.balance);
    metaboliseFor(world, 1);
    expect(cell.mass).toBeLessThan(aboveThePlateau);
    expect(player.dnaCumulative).toBe(0);
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

  it('reads the start-of-step radii: a toxic cell decayed earlier in the loop still reaches a cell it touched', () => {
    const build = (order: 'toxicFirst' | 'victimFirst') => {
      const world = createTestWorld({
        players: [
          { playerId: playerId('b'), playerName: 'B', avatarIndex: 0 },
          { playerId: playerId('c'), playerName: 'C', avatarIndex: 1 },
        ],
      });
      const [toxic, victim] = world.cells as [CellRecord, CellRecord];
      setCellMass(toxic, 400, DEFAULT_BALANCE);
      setCellMass(victim, 400, DEFAULT_BALANCE);
      toxic.x = BROTH_POINT.x;
      toxic.y = BROTH_POINT.y;
      // Exactly touching at the start of the step: one tick of decay on either radius breaks the contact.
      victim.x = BROTH_POINT.x + toxic.radius + victim.radius;
      victim.y = BROTH_POINT.y;
      toxic.modifiers.toxinDrainFractionPerSecond = 0.05;
      if (order === 'victimFirst') world.cells = [victim, toxic];
      metaboliseFor(world, 1);
      return victim.mass;
    };
    const drainedMass = 400 - 400 * 0.05 * (1 / 60);
    expect(build('toxicFirst')).toBeLessThan(drainedMass + 0.001);
    expect(build('toxicFirst')).toBe(build('victimFirst'));
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
    metaboliseFor(world, 1);
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
    metaboliseFor(world, 1);
    const rates = world.massFlow.metabolismByPlayer[ownPlayer.playerId]!.ratesPerSecond;
    expect(own.mass).toBe(growth.CELL_STARTING_MASS);
    expect((rates.toxin + rates.decay) * TICK_INTERVAL_S).toBeCloseTo(-surplus, RATE_DIGITS);
    const toxinFormula = (growth.CELL_STARTING_MASS + surplus) * tiers.toxin_vacuole[0]!.toxinDrainFractionPerSecond!;
    expect(-rates.toxin).toBeLessThan(toxinFormula);
  });

  it('records no flow for a cell with no player', () => {
    const { world, cell, player } = placedCell(WORKED_MASS);
    cell.playerId = null;
    metaboliseFor(world, 1);
    expect(world.massFlow.metabolismByPlayer[player.playerId]).toBeUndefined();
  });
});
