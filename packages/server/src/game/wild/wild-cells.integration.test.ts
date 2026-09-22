// The wild seats through the whole step (docs/architecture/server-simulation.md §3 steps 1, 4, 5, 9; docs/ecology/wild-cells.md
// §3.3; docs/ecology/acceptance.md §8.1 W8): the pin runs at step 1, the eating and metabolism steps skip a free
// wild cell, an engulfing one bleeds into its seat, `results` freezes them, a rematch recreates them, and two seeded
// runs with wild seats hash equal tick for tick.
import { describe, expect, it } from 'vitest';
import { CELL_KIND, DEFAULT_BALANCE, FOOD_KIND, ROUND_PHASE, secondsToTicks } from '@evolution/shared';
import { createTestWorld } from '../../testing/world-builders.js';
import { setCellMass } from '../simulation/cell-mass.js';
import { beginEngulf } from '../simulation/engulf-state.js';
import { resultsDurationTicks, roundDurationTicks, worldReferenceAt } from '../simulation/round-clock.js';
import { spawnFoodMote } from '../simulation/spawn-mote.js';
import { runStep } from '../simulation/step.js';
import type { CellRecord } from '../world/entities.js';
import { removeFromArray } from '../world/lookups.js';
import { computeStateHash } from '../world/state-hash.js';
import { createInputRejectionCounters, type WorldState } from '../world/world-state.js';

const { wildCells, growth, ecology } = DEFAULT_BALANCE;
const ONE_SECOND_TICKS = secondsToTicks(1);
const DETERMINISM_TICKS = 120;

function seeded(seed = 42): WorldState {
  return createTestWorld({ isFilled: true, hasWildSeats: true, seed });
}

function step(world: WorldState, ticks = 1): void {
  for (let count = 0; count < ticks; count += 1) {
    runStep(world, world.balance, createInputRejectionCounters());
  }
}

function wildCellsOf(world: WorldState): CellRecord[] {
  return world.cells.filter((cell) => cell.kind === CELL_KIND.wild);
}

describe('the wild seats through the step', () => {
  it('pins every wild cell at step 1 of every tick: after tick 60 the mass is exactly worldMass(1 s) × spread (W8)', () => {
    const world = seeded();
    step(world, ONE_SECOND_TICKS);
    const reference = worldReferenceAt(world, world.tick);
    expect(reference.worldMass).toBe(growth.CELL_STARTING_MASS + 1);
    for (const [index, cell] of wildCellsOf(world).entries()) {
      expect(cell.mass).toBe(reference.worldMass * world.wildSeats[index]!.massSpreadFactor);
    }
  });

  it('never eats: a mote placed inside a wild cell is still there after 60 ticks (W8)', () => {
    const world = seeded();
    const wild = wildCellsOf(world)[0]!;
    const mote = spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: { x: wild.x, y: wild.y } });
    step(world, ONE_SECOND_TICKS);
    expect(world.food).toContain(mote);
    expect(world.wildSeats[0]!.drainedMass).toBe(0);
  });

  it('bleeds while engulfing: step 5 books the decay against the seat and the next pin subtracts it', () => {
    const world = createTestWorld({ hasWildSeats: true });
    world.tick = secondsToTicks(70); // world mass 90: the wild predator has 70 of surplus to decay
    const seat = world.wildSeats[0]!;
    seat.massSpreadFactor = 1;
    const wild = wildCellsOf(world)[0]!;
    const prey = world.cells[0]!;
    prey.x = wild.x;
    prey.y = wild.y;
    prey.pinnedX = wild.x;
    prey.pinnedY = wild.y;
    setCellMass(wild, 90, world.balance);
    beginEngulf({ predator: wild, prey });
    step(world);
    const pinned = worldReferenceAt(world, world.tick).worldMass;
    const decayPerTick = ((pinned - growth.CELL_STARTING_MASS) * ecology.MASS_DECAY_RATE_PER_SECOND) / ONE_SECOND_TICKS;
    expect(seat.drainedMass).toBeCloseTo(decayPerTick, 6);
    expect(wild.mass).toBeCloseTo(pinned - decayPerTick, 6);
    step(world);
    const pinnedNext = worldReferenceAt(world, world.tick).worldMass;
    expect(seat.drainedMass).toBeGreaterThan(decayPerTick);
    expect(wild.mass).toBeLessThan(pinnedNext);
    expect(wild.mass).toBeCloseTo(pinnedNext - seat.drainedMass, 6);
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
    expect(wildCellsOf(world)).toHaveLength(wildCells.WILD_CELL_COUNT);
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
      expect(cell.mass).toBeLessThanOrEqual(growth.CELL_STARTING_MASS * (1 + wildCells.WILD_CELL_MASS_SPREAD));
    }
  });
});

describe('determinism with wild seats', () => {
  it('two runs from one seed hash equal every tick, and a changed spread changes the hash', () => {
    const first = seeded();
    const second = seeded();
    expect(computeStateHash(first)).toBe(computeStateHash(second));
    for (let tick = 0; tick < DETERMINISM_TICKS; tick += 1) {
      step(first);
      step(second);
      expect(computeStateHash(first)).toBe(computeStateHash(second));
    }
    second.wildSeats[0]!.massSpreadFactor += 0.01;
    expect(computeStateHash(first)).not.toBe(computeStateHash(second));
  });

  it('a different seed seats the wild cells elsewhere', () => {
    const positions = (world: WorldState) => wildCellsOf(world).map((cell) => [cell.x, cell.y]);
    expect(positions(seeded(42))).not.toEqual(positions(seeded(43)));
  });
});
