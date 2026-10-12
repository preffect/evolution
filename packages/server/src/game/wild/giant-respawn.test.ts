// docs/ecology/giants.md §3.5.8, §3.5.9 and docs/ecology/acceptance.md §8.2 G9 (the seat side): a giant seat whose
// cell is gone reads `respawnInTicks` = 5 400 on that tick, counts down by the wild count and is alive again on the
// tick after zero with a fresh born mass, no growth and its build, placed by the giant clearance.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, GIANT_SPECIES, RANDOM_STREAM, distanceBetween, secondsToTicks } from '@evolution/shared';
import { seatTestGiantCell } from '../../testing/wild-builders.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { NO_GAIN } from '../simulation/cell-mass.js';
import { absorbCell } from '../session/death.js';
import { storeStreams } from '../world/streams.js';
import type { WorldState } from '../world/world-state.js';
import { runGiantRespawns } from './giant-respawn.js';

const { giants } = DEFAULT_BALANCE;
const RESPAWN_TICKS = secondsToTicks(giants.GIANT_RESPAWN_SECONDS);
const DEATH_TICK = 45;
const AWAY = { x: 1500, y: 1500 };

function respawnAt(world: WorldState, tick: number): void {
  world.tick = tick;
  const context = createTestStepContext(world);
  runGiantRespawns(world, context);
  storeStreams(world, context.streams);
}

function eatenAmoeba() {
  const world = createTestWorld();
  const { seat, cell } = seatTestGiantCell(world, {
    species: GIANT_SPECIES.amoeba,
    at: AWAY,
    bornMass: 1000,
    grownMass: 200,
  });
  world.tick = DEATH_TICK;
  absorbCell(world, createTestStepContext(world), { prey: cell, predator: world.cells[0]!, predatorGain: NO_GAIN });
  return { world, seat, eatenCellId: cell.id };
}

describe('runGiantRespawns', () => {
  it('leaves a seated giant alone', () => {
    const world = createTestWorld();
    const { seat, cell } = seatTestGiantCell(world, { species: GIANT_SPECIES.diatom, at: AWAY, bornMass: 1200 });
    respawnAt(world, 1);
    expect([seat.cellId, seat.respawnInTicks]).toEqual([cell.id, 0]);
  });

  it('starts the 90 s countdown on the tick it notices the cell is gone', () => {
    const { world, seat } = eatenAmoeba();
    respawnAt(world, DEATH_TICK);
    expect([seat.cellId, seat.respawnInTicks]).toEqual([null, RESPAWN_TICKS]);
  });

  it('is vacant the tick 5 400 after and alive the tick after that, fresh, from the giants stream', () => {
    const { world, seat, eatenCellId } = eatenAmoeba();
    respawnAt(world, DEATH_TICK);
    for (let tick = DEATH_TICK + 1; tick <= DEATH_TICK + RESPAWN_TICKS; tick += 1) {
      respawnAt(world, tick);
    }
    expect([seat.cellId, seat.respawnInTicks]).toEqual([null, 0]);
    const giantsBefore = world.random[RANDOM_STREAM.giants].position;
    const placementBefore = world.random[RANDOM_STREAM.spawnPlacement];
    respawnAt(world, DEATH_TICK + RESPAWN_TICKS + 1);
    const cell = world.cells.find((candidate) => candidate.id === seat.cellId)!;
    expect(cell.id).not.toBe(eatenCellId);
    expect(cell.giantSpecies).toBe(GIANT_SPECIES.amoeba);
    expect(seat.bornMass).toBeGreaterThanOrEqual(giants.GIANT_BORN_MASS_MIN_BY_SPECIES.giant_amoeba);
    expect(seat.bornMass).toBeLessThan(giants.GIANT_BORN_MASS_MAX_BY_SPECIES.giant_amoeba);
    expect([cell.mass, seat.grownMass, seat.fullMass]).toEqual([seat.bornMass, 0, seat.bornMass]);
    expect(cell.traits).toEqual(giants.GIANT_BUILDS_BY_SPECIES.giant_amoeba);
    expect(distanceBetween(cell, world.cells[0]!)).toBeGreaterThanOrEqual(giants.GIANT_MIN_PLAYER_DISTANCE_WU);
    expect(world.random[RANDOM_STREAM.giants].position).toBeGreaterThan(giantsBefore);
    expect(world.random[RANDOM_STREAM.spawnPlacement]).toEqual(placementBefore);
  });
});
