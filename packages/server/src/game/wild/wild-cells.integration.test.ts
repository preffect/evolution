// The wild seats through the whole step (docs/architecture/server-simulation.md §3.4 steps 1, 4, 5, 9;
// docs/ecology/wild-cells.md §3.3.1; docs/ecology/acceptance.md §8.1 W8): the settle runs at step 1, a wild cell eats
// algae and detritus at step 4 (never bacteria or fragments) and keeps the meal as growth, a wound recovers with the
// 6 s time constant, step 5 drains it without base decay, `results` freezes them, a rematch recreates them, and two
// seeded runs with wild seats hash equal tick for tick.
import { describe, expect, it } from 'vitest';
import {
  BACTERIUM_VARIANT,
  CELL_KIND,
  DEFAULT_BALANCE,
  DNA_TAG,
  EFFECT_KIND,
  FOOD_KIND,
  ROUND_PHASE,
  TICK_INTERVAL_S,
  secondsToTicks,
  type EntityId,
  type GameEffect,
} from '@evolution/shared';
import { createTestWorld } from '../../testing/world-builders.js';
import { setCellMass } from '../simulation/cell-mass.js';
import { resultsDurationTicks, roundDurationTicks, worldReferenceAt } from '../simulation/round-clock.js';
import { spawnDnaFragment, spawnFoodMote } from '../simulation/spawn-mote.js';
import { runStep } from '../simulation/step.js';
import type { CellRecord, WildSeatRecord } from '../world/entities.js';
import { removeFromArray } from '../world/lookups.js';
import { computeStateHash } from '../world/state-hash.js';
import { createInputRejectionCounters, type WorldState } from '../world/world-state.js';
import { wildRecoveryFactorPerTick } from './wild-settle.js';

const { wildCells, growth, ecology } = DEFAULT_BALANCE;
const ONE_SECOND_TICKS = secondsToTicks(1);
const DETERMINISM_TICKS = 120;
const MASS_DIGITS = 6;
/** A wound or a meal the tests lay on a cell. */
const WOUND_MASS = 10;
const MEAL_MASS = 10;
/** The seeded run the settle invariants are read over, and the float slack a comparison allows. */
const INVARIANT_TICKS = 1200;
const INVARIANT_EPSILON = 1e-9;
const CEILING_MULTIPLE = wildCells.WILD_CELL_MAX_WORLD_MASS_MULTIPLE;

function seeded(seed = 42): WorldState {
  return createTestWorld({ isFilled: true, hasWildSeats: true, seed });
}

/** The seats and their cells in an empty dish: nothing to eat, so a cell changes only by what a test does. */
function emptyDish(): WorldState {
  return createTestWorld({ hasWildSeats: true });
}

function step(world: WorldState, ticks = 1): void {
  for (let count = 0; count < ticks; count += 1) {
    runStep(world, world.balance, createInputRejectionCounters());
  }
}

function wildCellsOf(world: WorldState): CellRecord[] {
  return world.cells.filter((cell) => cell.kind === CELL_KIND.wild);
}

/**
 * The cell a meal or a payout fed on this tick: in the protocell era these are the only ways a wild cell rises above
 * its full size after the settle (from the third world level, seat 1's chloroplast adds the light).
 */
function fedCellIdOf(effect: GameEffect): EntityId[] {
  if (effect.kind === EFFECT_KIND.eat) return [effect.cellId];
  if (effect.kind === EFFECT_KIND.cellAbsorbed) return [effect.predatorCellId];
  return [];
}

function firstSeat(world: WorldState): { seat: WildSeatRecord; wild: CellRecord } {
  return { seat: world.wildSeats[0]!, wild: wildCellsOf(world)[0]! };
}

describe('the wild seats through the step', () => {
  it('settles every untouched wild cell at step 1 at its base size: after tick 60 exactly worldMass(1 s) × size (W8)', () => {
    const world = emptyDish();
    step(world, ONE_SECOND_TICKS);
    const reference = worldReferenceAt(world, world.tick);
    expect(reference.worldMass).toBe(growth.CELL_STARTING_MASS + 1);
    for (const [index, cell] of wildCellsOf(world).entries()) {
      const seat = world.wildSeats[index]!;
      expect(cell.mass).toBe(reference.worldMass * seat.sizeFactor);
      expect([seat.grownMass, seat.fullMass]).toEqual([0, cell.mass]);
    }
  });

  it('eats an algae mote it touches and keeps it as growth; bacteria and fragments stay for the players (W8)', () => {
    const world = emptyDish();
    const { seat, wild } = firstSeat(world);
    const centre = { x: wild.x, y: wild.y };
    const algae = spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: centre });
    const bacterium = spawnFoodMote(world, { kind: FOOD_KIND.bacterium, variant: BACTERIUM_VARIANT.plain, at: centre });
    const fragment = spawnDnaFragment(world, { tag: DNA_TAG.photic, at: centre, driftTurn: 0 });
    step(world);
    expect(world.food).not.toContain(algae);
    expect(world.food).toContain(bacterium);
    expect(world.dnaFragments).toContain(fragment);
    expect(wild.mass - seat.fullMass).toBeCloseTo(algae.mass, MASS_DIGITS);
    step(world);
    expect(seat.grownMass).toBeGreaterThan(algae.mass * (1 - ecology.MASS_DECAY_RATE_PER_SECOND));
    expect(seat.grownMass).toBeLessThan(algae.mass);
  });

  it('keeps a meal as growth that only the player decay removes, and recovers a wound by q a tick', () => {
    const world = emptyDish();
    const { seat, wild } = firstSeat(world);
    setCellMass(wild, seat.fullMass + MEAL_MASS, world.balance);
    const decayAtMeal = (wild.mass - growth.CELL_STARTING_MASS) * ecology.MASS_DECAY_RATE_PER_SECOND;
    step(world);
    expect(seat.grownMass).toBeCloseTo(MEAL_MASS - decayAtMeal * TICK_INTERVAL_S, MASS_DIGITS);
    expect(wild.mass).toBe(seat.fullMass);
    setCellMass(wild, seat.fullMass - WOUND_MASS, world.balance);
    step(world);
    expect(seat.fullMass - wild.mass).toBeCloseTo(WOUND_MASS * wildRecoveryFactorPerTick(DEFAULT_BALANCE), 6);
  });

  it('takes no base decay at step 5: a wild cell with no growth never shrinks by itself, however heavy', () => {
    const world = emptyDish();
    world.tick = secondsToTicks(300); // world mass 320: every seat far above the starting mass
    step(world, ONE_SECOND_TICKS);
    const reference = worldReferenceAt(world, world.tick);
    for (const [index, cell] of wildCellsOf(world).entries()) {
      expect(cell.mass).toBeCloseTo(reference.worldMass * world.wildSeats[index]!.sizeFactor, MASS_DIGITS);
    }
  });

  it('holds the settle invariants on a seeded run: growth ≥ 0, full size within its bounds, mass at most the full size', () => {
    const world = seeded();
    for (let tick = 0; tick < INVARIANT_TICKS; tick += 1) {
      const effectsBefore = world.effects.length;
      step(world);
      const fedThisTick = new Set(world.effects.slice(effectsBefore).flatMap(fedCellIdOf));
      const worldMass = worldReferenceAt(world, world.tick).worldMass;
      for (const seat of world.wildSeats) {
        const cell = wildCellsOf(world).find((candidate) => candidate.id === seat.cellId);
        if (cell === undefined) continue;
        const baseMass = worldMass * seat.sizeFactor;
        expect(seat.grownMass).toBeGreaterThanOrEqual(0);
        expect(seat.fullMass).toBeGreaterThanOrEqual(baseMass - INVARIANT_EPSILON);
        expect(seat.fullMass).toBeLessThanOrEqual(Math.max(baseMass, CEILING_MULTIPLE * worldMass) + INVARIANT_EPSILON);
        expect(cell.mass).toBeGreaterThanOrEqual(Math.min(growth.CELL_STARTING_MASS, baseMass) - INVARIANT_EPSILON);
        if (!fedThisTick.has(cell.id)) {
          expect(cell.mass).toBeLessThanOrEqual(seat.fullMass + INVARIANT_EPSILON);
        }
      }
    }
  });

  it('vacates an absorbed seat at step 9 and seats it again after WILD_CELL_RESPAWN_SECONDS', () => {
    const world = seeded();
    const seat = world.wildSeats[3]!;
    removeFromArray(world.cells, wildCellsOf(world)[3]!);
    step(world);
    expect(seat.cellId).toBeNull();
    expect(seat.respawnInTicks).toBe(secondsToTicks(wildCells.WILD_CELL_RESPAWN_SECONDS));
    step(world, secondsToTicks(wildCells.WILD_CELL_RESPAWN_SECONDS));
    expect(seat.cellId).toBeNull();
    step(world);
    expect(seat.cellId).not.toBeNull();
    // The seat's own cell, not a head count: the other seats hunt through these ten seconds, and a meal among them
    // vacates a seat of its own (#634 made the grab hold often enough to land one on this seed).
    expect(wildCellsOf(world).map((cell) => cell.id)).toContain(seat.cellId);
    expect(world.wildSeats).toHaveLength(wildCells.WILD_CELL_COUNT);
  });

  it('freezes the wild cells through results and recreates them at protocell scale on the rematch', () => {
    const world = seeded();
    world.tick = roundDurationTicks(world) - 1;
    step(world);
    expect(world.roundPhase).toBe(ROUND_PHASE.results);
    const frozen = wildCellsOf(world).map((cell) => [cell.mass, cell.level, cell.x] as const);
    expect(frozen[0]![1]).toBeGreaterThan(1);
    step(world, 5);
    expect(wildCellsOf(world).map((cell) => [cell.mass, cell.level, cell.x] as const)).toEqual(frozen);
    world.tick = roundDurationTicks(world) + resultsDurationTicks(world.balance) - 1;
    step(world);
    expect(world.roundPhase).toBe(ROUND_PHASE.playing);
    expect(world.wildSeats).toHaveLength(wildCells.WILD_CELL_COUNT);
    const reborn = wildCellsOf(world);
    expect(reborn).toHaveLength(wildCells.WILD_CELL_COUNT);
    for (const cell of reborn) {
      expect(cell.level).toBe(1);
      expect(cell.mass).toBeLessThanOrEqual(growth.CELL_STARTING_MASS * wildCells.WILD_CELL_SIZE_FACTOR_MAX);
    }
  });
});

describe('determinism with wild seats', () => {
  it('two runs from one seed hash equal every tick, and a changed size, growth, full size or starving flag changes the hash', () => {
    const first = seeded();
    const second = seeded();
    expect(computeStateHash(first)).toBe(computeStateHash(second));
    for (let tick = 0; tick < DETERMINISM_TICKS; tick += 1) {
      step(first);
      step(second);
      expect(computeStateHash(first)).toBe(computeStateHash(second));
    }
    const hashBefore = computeStateHash(second);
    const seat = second.wildSeats[0]!;
    for (const field of ['sizeFactor', 'grownMass', 'fullMass'] as const) {
      const value = seat[field];
      seat[field] = value + WOUND_MASS;
      expect(computeStateHash(second)).not.toBe(hashBefore);
      seat[field] = value;
    }
    seat.isStarving = !seat.isStarving;
    expect(computeStateHash(second)).not.toBe(hashBefore);
    seat.isStarving = !seat.isStarving;
    expect(computeStateHash(second)).toBe(hashBefore);
  });

  it('a different seed seats the wild cells elsewhere', () => {
    const positions = (world: WorldState) => wildCellsOf(world).map((cell) => [cell.x, cell.y]);
    expect(positions(seeded(42))).not.toEqual(positions(seeded(43)));
  });
});
