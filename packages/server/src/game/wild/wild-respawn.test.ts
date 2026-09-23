// docs/ecology/acceptance.md §8.1 W4 (the seat side) and docs/ecology/wild-cells.md §3.3 "Placement and respawn": a
// seat whose cell is gone reads `respawnInTicks` = 600 on that tick, counts down and is alive again on the tick after
// zero, at the world's mass × a fresh size factor with no growth; the seat count never changes.
import { describe, expect, it } from 'vitest';
import { CELL_KIND, DEFAULT_BALANCE, RANDOM_STREAM, secondsToTicks, type EntityId } from '@evolution/shared';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { NO_GAIN } from '../simulation/cell-mass.js';
import { worldReferenceAt } from '../simulation/round-clock.js';
import { absorbCell } from '../session/death.js';
import { storeStreams } from '../world/streams.js';
import type { WorldState } from '../world/world-state.js';
import { runWildRespawns } from './wild-respawn.js';
import { createWildSeatRecord, placeWildCell } from './wild-seats.js';

const { wildCells } = DEFAULT_BALANCE;
const RESPAWN_TICKS = secondsToTicks(wildCells.WILD_CELL_RESPAWN_SECONDS);
/** A placement draws the size factor and the first heading. */
const WILD_DRAWS_PER_PLACEMENT = 2;
/** W4: seat 0 is paid out on tick 36. */
const DEATH_TICK = 36;

function eatenSeat(): { world: WorldState; eatenCellId: EntityId } {
  const world = createTestWorld();
  const seat = createWildSeatRecord(0);
  world.wildSeats.push(seat);
  const context = createTestStepContext(world);
  const prey = placeWildCell(world, seat, context, worldReferenceAt(world, world.tick));
  storeStreams(world, context.streams); // as the step would: the respawn draws the next size, not this one again
  world.tick = DEATH_TICK;
  absorbCell(world, createTestStepContext(world), { prey, predator: world.cells[0]!, predatorGain: NO_GAIN });
  return { world, eatenCellId: prey.id };
}

function respawnAt(world: WorldState, tick: number): void {
  world.tick = tick;
  runWildRespawns(world, createTestStepContext(world));
}

describe('runWildRespawns (W4)', () => {
  it('leaves a seated cell alone', () => {
    const world = createTestWorld();
    const seat = createWildSeatRecord(0);
    world.wildSeats.push(seat);
    const cell = placeWildCell(world, seat, createTestStepContext(world), worldReferenceAt(world, world.tick));
    respawnAt(world, 1);
    expect(seat.cellId).toBe(cell.id);
    expect(seat.respawnInTicks).toBe(0);
    expect(world.cells).toHaveLength(2);
  });

  it('vacates the seat on the tick the cell was absorbed with the full countdown, and counts down from the next', () => {
    const { world } = eatenSeat();
    const seat = world.wildSeats[0]!;
    expect(world.cells).toHaveLength(1);
    respawnAt(world, DEATH_TICK);
    expect(seat.cellId).toBeNull();
    expect(seat.respawnInTicks).toBe(RESPAWN_TICKS);
    for (let tick = DEATH_TICK + 1; tick <= DEATH_TICK + RESPAWN_TICKS; tick += 1) {
      respawnAt(world, tick);
      expect(seat.cellId).toBeNull();
      expect(seat.respawnInTicks).toBe(DEATH_TICK + RESPAWN_TICKS - tick);
    }
    expect(world.cells).toHaveLength(1);
    expect(world.wildSeats).toHaveLength(1);
  });

  it('is alive again on tick 637 at the world mass × a fresh size, no growth, with a new cell id', () => {
    const { world, eatenCellId } = eatenSeat();
    const seat = world.wildSeats[0]!;
    const sizeBefore = seat.sizeFactor;
    seat.grownMass = 7;
    const wildDrawsBefore = world.random[RANDOM_STREAM.wildCells].position;
    for (let tick = DEATH_TICK; tick <= DEATH_TICK + RESPAWN_TICKS; tick += 1) {
      respawnAt(world, tick);
    }
    const aliveTick = DEATH_TICK + RESPAWN_TICKS + 1;
    world.tick = aliveTick;
    const context = createTestStepContext(world);
    runWildRespawns(world, context);
    const cell = world.cells.find((entry) => entry.kind === CELL_KIND.wild)!;
    expect(seat.cellId).toBe(cell.id);
    expect(cell.id).not.toBe(eatenCellId);
    expect(seat.respawnInTicks).toBe(0);
    // 637 ticks → 10.617 s → world mass 30.617, a size within [0.5, 2.0]: [15.31, 61.23] (W4).
    expect(cell.mass).toBeCloseTo(worldReferenceAt(world, aliveTick).worldMass * seat.sizeFactor, 10);
    expect(cell.mass).toBeGreaterThanOrEqual(15.31);
    expect(cell.mass).toBeLessThanOrEqual(61.23);
    expect([seat.grownMass, seat.fullMass]).toEqual([0, cell.mass]);
    expect(seat.sizeFactor).not.toBe(sizeBefore);
    expect(context.streams[RANDOM_STREAM.wildCells].getState().position).toBe(
      wildDrawsBefore + WILD_DRAWS_PER_PLACEMENT,
    );
  });
});
