// The #73 acceptance wire: the seeded streams, the injected clock with the fixed-step
// accumulator and the state hash together. A toy world (no gameplay) is stepped 10 000 ticks
// from seed 42 under a ManualClock twice; the hash must agree every 600 ticks and at the end.
// Streams resume from their stored state each tick and write it back, exactly as step.ts will.

import { describe, expect, it } from 'vitest';
import { TICK_INTERVAL_MS } from '../constants/network.js';
import { hashRandomStreams, hashScalarArray } from '../simulation/state-hash.js';
import { StateHasher, type StateHash } from '../simulation/state-hasher.js';
import { ManualClock } from '../time/clock.js';
import { createSimulationStepAccumulator } from '../time/fixed-step-accumulator.js';
import type { RandomState } from './random-source.js';
import { createSeededRandom, createSeededRandomFromState } from './seeded-random.js';
import { forkStreamStates } from './stream-forking.js';
import { RANDOM_STREAM, SERVER_RANDOM_STREAM_LABELS, type ServerRandomStreamLabel } from './stream-labels.js';

const ACCEPTANCE_SEED = 42;
const OTHER_SEED = 43;
const TOTAL_TICKS = 10_000;
const HASH_EVERY_TICKS = 600;
const MOTES_PER_TICK = 8;
const FEWER_MOTES_PER_TICK = 3;
const SPAWN_INTERVAL_TICKS = 7;
/** Ticks per ticker fire; divides TOTAL_TICKS and stays under MAX_TICKS_PER_ADVANCE. */
const STEP_BURST_TICKS = 4;

interface ToyWorld {
  tick: number;
  seed: number;
  headings: number[];
  spawns: number[];
  random: Record<ServerRandomStreamLabel, RandomState>;
}

function createToyWorld(seed: number): ToyWorld {
  const random = forkStreamStates(createSeededRandom(seed), SERVER_RANDOM_STREAM_LABELS);
  return { tick: 0, seed, headings: [], spawns: [], random };
}

/** One tick: every mote draws a heading from its stream; every seventh tick the spawner draws. */
function stepToyWorld(world: ToyWorld, motesPerTick: number): void {
  const motion = createSeededRandomFromState(world.random[RANDOM_STREAM.moteMotion]);
  for (let mote = 0; mote < motesPerTick; mote += 1) {
    world.headings.push(motion.nextFloat());
  }
  world.random[RANDOM_STREAM.moteMotion] = motion.getState();
  if (world.tick % SPAWN_INTERVAL_TICKS === 0) {
    const spawner = createSeededRandomFromState(world.random[RANDOM_STREAM.spawner]);
    world.spawns.push(spawner.weightedIndex([1, 2, 3]));
    world.random[RANDOM_STREAM.spawner] = spawner.getState();
  }
  world.tick += 1;
}

function hashToyWorld(world: ToyWorld): StateHash {
  const hasher = new StateHasher().hashNumber(world.tick).hashNumber(world.seed);
  hashScalarArray(hasher, world.headings);
  hashScalarArray(hasher, world.spawns);
  hashRandomStreams(hasher, world.random, SERVER_RANDOM_STREAM_LABELS);
  return hasher.digest();
}

/** Runs the world under a manual clock and returns the hash at every checkpoint. */
function runUnderManualClock(seed: number): StateHash[] {
  const world = createToyWorld(seed);
  const clock = new ManualClock();
  const accumulator = createSimulationStepAccumulator(clock);
  const checkpoints: StateHash[] = [];
  while (world.tick < TOTAL_TICKS) {
    clock.advanceMilliseconds(TICK_INTERVAL_MS * STEP_BURST_TICKS);
    for (let due = accumulator.dueTicks(); due > 0; due -= 1) {
      stepToyWorld(world, MOTES_PER_TICK);
      if (world.tick % HASH_EVERY_TICKS === 0 || world.tick === TOTAL_TICKS) {
        checkpoints.push(hashToyWorld(world));
      }
    }
  }
  expect(world.tick).toBe(TOTAL_TICKS);
  expect(accumulator.takeDroppedTicks()).toBe(0);
  return checkpoints;
}

/** Steps a fresh world `ticks` times with `motesPerTick` mote draws per tick. */
function runToyWorld(seed: number, ticks: number, motesPerTick: number): ToyWorld {
  const world = createToyWorld(seed);
  while (world.tick < ticks) {
    stepToyWorld(world, motesPerTick);
  }
  return world;
}

describe('determinism wire: streams + clock + hash', () => {
  it('yields an identical state hash at every checkpoint across two 10 000-tick runs of seed 42', () => {
    const firstRun = runUnderManualClock(ACCEPTANCE_SEED);
    const secondRun = runUnderManualClock(ACCEPTANCE_SEED);
    expect(firstRun.length).toBe(Math.ceil(TOTAL_TICKS / HASH_EVERY_TICKS));
    expect(secondRun).toEqual(firstRun);
  });

  it('diverges for a different seed from the first checkpoint on', () => {
    const seed42 = runUnderManualClock(ACCEPTANCE_SEED);
    const seed43 = runUnderManualClock(OTHER_SEED);
    expect(seed43[0]).not.toBe(seed42[0]);
    expect(seed43.at(-1)).not.toBe(seed42.at(-1));
  });

  it('keeps the spawner stream unaffected by how many mote draws happened', () => {
    const manyMotes = runToyWorld(ACCEPTANCE_SEED, HASH_EVERY_TICKS, MOTES_PER_TICK);
    const fewMotes = runToyWorld(ACCEPTANCE_SEED, HASH_EVERY_TICKS, FEWER_MOTES_PER_TICK);
    expect(fewMotes.headings).not.toEqual(manyMotes.headings);
    expect(fewMotes.random[RANDOM_STREAM.moteMotion]).not.toEqual(manyMotes.random[RANDOM_STREAM.moteMotion]);
    expect(fewMotes.spawns).toEqual(manyMotes.spawns);
    expect(fewMotes.random[RANDOM_STREAM.spawner]).toEqual(manyMotes.random[RANDOM_STREAM.spawner]);
  });
});
