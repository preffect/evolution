// A recorded trajectory of the movement step (#554): `moveCells` run for a fixed script of targets over every factor
// the shared `movement-step.ts` folds (mass curve, sprint, gel, trait speed and acceleration, the engulf factors, the
// carried prey, the dish wall), with every cell's pose hashed on every tick. The server and the client prediction
// (docs/architecture/client.md §5, #265) share that step, so any change to its arithmetic or its order moves this
// hash. A deliberate change re-records it: run the test, read the new digest from the failure, and say why in the PR.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, StateHasher, type StateHash } from '@evolution/shared';
import { createEngulfFixture } from '../../testing/engulf-builders.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { refreshCellDerivedState } from '../progression/modifiers.js';
import type { WorldState } from '../world/world-state.js';
import { setCellMass } from './cell-mass.js';
import { beginEngulf, sealEngulf } from './engulf-state.js';
import { moveCells } from './movement.js';

/**
 * The digests of the two scripted runs below, recorded on main after #265 (`movement-step.ts`); the engulf run
 * re-recorded by #634, which changed the engulf factors (the prey grabbed in cover, the predator unslowed).
 */
const RECORDED_TRAJECTORY_HASHES = { solo: '7aa523684682f564', engulf: 'c89732cfaa8bfc4b' };

const SOLO_TICKS = 240;
/** A mass whose four cap factors round differently when multiplied in another order (at 300 they happen not to). */
const SOLO_MASS = 250;
const STEER_RADIUS_WU = 400;
/** Ticks per radian of the circling target: a full turn in about 125 ticks. */
const TICKS_PER_RADIAN = 20;
/** Early, while the cell is still inside the gel: sprint, gel, trait and mass factors all multiply at once. */
const SPRINT_START_TICK = 5;
const SPRINT_TICKS = 30;
const WALL_START = { x: 2850, y: 400 };
const WALL_TICKS = 120;
const ENGULF_TICKS_BEFORE_SEAL = 30;
const ENGULF_TICKS_AFTER_SEAL = 30;

/** Every cell's pose, in world order, into the hash: the whole observable output of one movement tick. */
function hashPoses(hasher: StateHasher, world: WorldState): void {
  for (const cell of world.cells) {
    hasher.hashNumber(cell.x).hashNumber(cell.y).hashNumber(cell.velocityX).hashNumber(cell.velocityY);
  }
}

/** A grown Cilia III cell on seed 42's first gel patch, circling a moving target, sprinting once, then at the wall. */
function soloRun(hasher: StateHasher): void {
  const world = createTestWorld();
  const patch = world.gelPatches[0]!;
  const cell = world.cells[0]!;
  const player = world.players[0]!;
  player.ownedTraits.push({ traitId: 'cilia', tier: 3 });
  cell.x = patch.x;
  cell.y = patch.y;
  setCellMass(cell, SOLO_MASS, DEFAULT_BALANCE);
  refreshCellDerivedState(cell, player, DEFAULT_BALANCE);
  const context = createTestStepContext(world);
  for (let tick = 0; tick < SOLO_TICKS; tick += 1) {
    const angle = tick / TICKS_PER_RADIAN;
    cell.targetX = patch.x + STEER_RADIUS_WU * Math.cos(angle);
    cell.targetY = patch.y + STEER_RADIUS_WU * Math.sin(angle);
    if (tick === SPRINT_START_TICK) cell.sprintRemainingTicks = SPRINT_TICKS;
    moveCells(world, context);
    hashPoses(hasher, world);
  }
  cell.x = WALL_START.x;
  cell.y = WALL_START.y;
  cell.targetX = WALL_START.x * 2;
  cell.targetY = WALL_START.y * 2;
  for (let tick = 0; tick < WALL_TICKS; tick += 1) {
    moveCells(world, context);
    hashPoses(hasher, world);
  }
}

/**
 * The E9 pair steering apart: the predator (with Cilia, so three factors multiply) slowed while it wraps, then the
 * sealed prey carried at its offset.
 */
function engulfRun(hasher: StateHasher): void {
  const fixture = createEngulfFixture();
  const { world, predator, prey } = fixture;
  const predatorPlayer = world.players[0]!;
  predatorPlayer.ownedTraits.push({ traitId: 'cilia', tier: 3 });
  refreshCellDerivedState(predator, predatorPlayer, DEFAULT_BALANCE);
  beginEngulf(fixture);
  prey.engulfProgress = DEFAULT_BALANCE.absorption.ENGULF_WRAP_START_PROGRESS;
  predator.targetX = predator.x - STEER_RADIUS_WU;
  prey.targetX = prey.x + STEER_RADIUS_WU;
  const context = createTestStepContext(world);
  for (let tick = 0; tick < ENGULF_TICKS_BEFORE_SEAL; tick += 1) {
    moveCells(world, context);
    hashPoses(hasher, world);
  }
  prey.engulfProgress = DEFAULT_BALANCE.absorption.ENGULF_SEAL_PROGRESS;
  sealEngulf(fixture);
  for (let tick = 0; tick < ENGULF_TICKS_AFTER_SEAL; tick += 1) {
    moveCells(world, context);
    hashPoses(hasher, world);
  }
}

/** One digest per run, so a failure says which part of the step moved. */
function recordTrajectory(): { solo: StateHash; engulf: StateHash } {
  const solo = new StateHasher();
  soloRun(solo);
  const engulf = new StateHasher();
  engulfRun(engulf);
  return { solo: solo.digest(), engulf: engulf.digest() };
}

describe('the movement trajectory (#554)', () => {
  it('replays to the recorded hash: the shared movement step has not moved', () => {
    expect(recordTrajectory()).toEqual(RECORDED_TRAJECTORY_HASHES);
  });

  it('is deterministic: two runs in one process agree', () => {
    expect(recordTrajectory()).toEqual(recordTrajectory());
  });
});
