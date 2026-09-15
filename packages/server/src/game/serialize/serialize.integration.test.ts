// Integration (docs/testing/tiers-and-builders.md §2, #341): the simulation, the serializer and the state hash together.
// The wire rounds a cell's position, velocity, mass and radius and a leaderboard row's score and mass
// (docs/architecture/wire-contract.md §4.2 lever 3), but only in the view: a world broadcast every
// `SNAPSHOT_EVERY_TICKS` hashes exactly as the same world never serialised (docs/determinism/ordering-and-state-hash.md
// §5), and its records keep full precision. Run with `./validate.sh integration`.
import { describe, expect, it } from 'vitest';
import {
  SNAPSHOT_EVERY_TICKS,
  SNAPSHOT_MASS_DECIMALS,
  SNAPSHOT_RADIUS_DECIMALS,
  SNAPSHOT_SCORE_DECIMALS,
  SNAPSHOT_VELOCITY_DECIMALS,
  createTestGameInput,
  playerId,
} from '@evolution/shared';
import { TEST_PLAYER, createTestWorld } from '../../testing/world-builders.js';
import { runStep } from '../simulation/step.js';
import { computeStateHash } from '../world/state-hash.js';
import { createInputRejectionCounters, type WorldState } from '../world/world-state.js';
import { quantizeToDecimals } from './quantize.js';
import { serializeBroadcastSnapshot, serializeFullSnapshot } from './serialize.js';

/** Twenty seconds: long enough for the cells to eat, grow, decay and change course many times. */
const TOTAL_TICKS = 1200;
/** Enough ticks for both cells to be moving on a fractional velocity. */
const WARM_UP_TICKS = 60;
const BOB = { playerId: playerId('p2'), playerName: 'Bob', avatarIndex: 1 };
/** Each player steers to a point that turns with the tick, so velocities never settle on round numbers. */
const TARGET_RADIUS_WU = 800;
const TARGET_TURN_TICKS = 300;

function seededDish(): WorldState {
  return createTestWorld({ isFilled: true, players: [TEST_PLAYER, BOB] });
}

/** Feeds every player's input for `tick`, then steps the world to it. */
function stepTo(world: WorldState, tick: number): void {
  world.players.forEach((player, index) => {
    const angle = ((tick + index * TARGET_TURN_TICKS) / TARGET_TURN_TICKS) * Math.PI;
    player.pendingInput = createTestGameInput({
      sequence: tick,
      targetX: Math.cos(angle) * TARGET_RADIUS_WU,
      targetY: Math.sin(angle) * TARGET_RADIUS_WU,
    });
  });
  runStep(world, world.balance, createInputRejectionCounters());
}

describe('wire quantisation never reaches the simulation (#341)', () => {
  it('a world serialised on every broadcast tick hashes as the same world never serialised', () => {
    const broadcast = seededDish();
    const silent = seededDish();
    for (let tick = 1; tick <= TOTAL_TICKS; tick += 1) {
      stepTo(broadcast, tick);
      stepTo(silent, tick);
      if (tick % SNAPSHOT_EVERY_TICKS !== 0) continue;
      serializeBroadcastSnapshot(broadcast);
      serializeFullSnapshot(broadcast);
      // Effects are transient and unhashed; drained alike so both worlds hold the same arrays.
      silent.effects.splice(0);
      expect(computeStateHash(broadcast)).toBe(computeStateHash(silent));
    }
    expect(broadcast.tick).toBe(TOTAL_TICKS);
  });

  it('rounds the view of a live cell and leaderboard, and leaves the records and the hash as they were', () => {
    const world = seededDish();
    for (let tick = 1; tick <= WARM_UP_TICKS; tick += 1) stepTo(world, tick);
    const cellsBefore = structuredClone(world.cells);
    const leaderboardBefore = structuredClone(world.leaderboard);
    const hashBefore = computeStateHash(world);

    const snapshot = serializeFullSnapshot(world);

    expect(world.cells).toEqual(cellsBefore);
    expect(world.leaderboard).toEqual(leaderboardBefore);
    expect(computeStateHash(world)).toBe(hashBefore);
    world.cells.forEach((cell, index) => {
      expect(snapshot.cells[index]).toMatchObject({
        velocityX: quantizeToDecimals(cell.velocityX, SNAPSHOT_VELOCITY_DECIMALS),
        velocityY: quantizeToDecimals(cell.velocityY, SNAPSHOT_VELOCITY_DECIMALS),
        mass: quantizeToDecimals(cell.mass, SNAPSHOT_MASS_DECIMALS),
        radius: quantizeToDecimals(cell.radius, SNAPSHOT_RADIUS_DECIMALS),
      });
    });
    world.leaderboard.forEach((row, index) => {
      expect(snapshot.leaderboard[index]).toMatchObject({
        score: quantizeToDecimals(row.score, SNAPSHOT_SCORE_DECIMALS),
        mass: quantizeToDecimals(row.mass, SNAPSHOT_MASS_DECIMALS),
      });
    });
    // The rounding is real on a live dish: a starting radius (4 √20) and a moving velocity are never round.
    expect(snapshot.cells.some((view, index) => view.radius !== world.cells[index]!.radius)).toBe(true);
    expect(snapshot.cells.some((view, index) => view.velocityX !== world.cells[index]!.velocityX)).toBe(true);
  });
});
