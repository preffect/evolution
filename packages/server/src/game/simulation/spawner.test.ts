// docs/ECOLOGY.md §3 and §8 E2/E3 on the spawners alone (no eating, the cell idle).
import { describe, expect, it } from 'vitest';
import { createSeededRandom, DEFAULT_BALANCE, FOOD_KIND, RANDOM_STREAM, TICK_HZ } from '@evolution/shared';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { storeStreams } from '../world/streams.js';
import type { WorldState } from '../world/world-state.js';
import { runInitialFill, runSpawners, spawnFoodEvent } from './spawner.js';
import { foodSpawnerRates, fragmentSpawnerRates } from './spawn-rates.js';

const { ecology } = DEFAULT_BALANCE;
const TEN_SECONDS_TICKS = 600;

/** Steps the spawners `ticks` times the way step.ts does: resume, run, write back. */
function runSpawnersFor(world: WorldState, ticks: number): void {
  for (let tick = 0; tick < ticks; tick += 1) {
    world.tick += 1;
    const context = createTestStepContext(world);
    runSpawners(world, context);
    storeStreams(world, context.streams);
  }
}

describe('runSpawners', () => {
  it('E2: spends the food rate in 600 ticks, overshooting by less than a cluster; fragments exactly', () => {
    const world = createTestWorld({ isFilled: true });
    const foodRate = foodSpawnerRates(world, DEFAULT_BALANCE).ratePerSecond;
    const fragmentRate = fragmentSpawnerRates(world, DEFAULT_BALANCE).ratePerSecond;
    runSpawnersFor(world, TEN_SECONDS_TICKS);
    const foodSpawned =
      world.spawners.food.spawnedCount -
      Math.floor(ecology.FOOD_INITIAL_FILL_FRACTION * foodSpawnerRates(world, DEFAULT_BALANCE).cap);
    const expectedFood = Math.floor((foodRate * TEN_SECONDS_TICKS) / TICK_HZ);
    expect(foodSpawned).toBeGreaterThanOrEqual(expectedFood);
    expect(foodSpawned).toBeLessThan(expectedFood + ecology.BACTERIUM_CLUSTER_SIZE);
    const fragmentsSpawned =
      world.spawners.dnaFragments.spawnedCount -
      Math.floor(ecology.DNA_FRAGMENT_INITIAL_FILL_FRACTION * fragmentSpawnerRates(world, DEFAULT_BALANCE).cap);
    expect(fragmentsSpawned).toBe(Math.floor((fragmentRate * TEN_SECONDS_TICKS) / TICK_HZ));
  });

  it('E3: reaches both caps and never exceeds them, clusters included', () => {
    const world = createTestWorld({ isFilled: true });
    const foodCap = foodSpawnerRates(world, DEFAULT_BALANCE).cap;
    const fragmentCap = fragmentSpawnerRates(world, DEFAULT_BALANCE).cap;
    for (let tick = 0; tick < 3000; tick += 1) {
      runSpawnersFor(world, 1);
      expect(world.food.length).toBeLessThanOrEqual(foodCap);
      expect(world.dnaFragments.length).toBeLessThanOrEqual(fragmentCap);
    }
    expect(world.food.length).toBe(foodCap);
    expect(world.dnaFragments.length).toBe(fragmentCap);
  });

  it('spawns nothing while a spawner is disabled', () => {
    const world = createTestWorld();
    runSpawnersFor(world, TEN_SECONDS_TICKS);
    expect(world.food).toHaveLength(0);
    expect(world.dnaFragments).toHaveLength(0);
    expect(world.spawners.food.accumulator).toBe(0);
  });

  it('lets the accumulator go negative after a cluster and recover before the next spawn', () => {
    const world = createTestWorld({ isFilled: true });
    world.dnaFragments = [];
    world.spawners.dnaFragments.isEnabled = false;
    let hasSeenNegative = false;
    for (let tick = 0; tick < TEN_SECONDS_TICKS; tick += 1) {
      runSpawnersFor(world, 1);
      if (world.spawners.food.accumulator < 0) hasSeenNegative = true;
      expect(world.spawners.food.accumulator).toBeLessThan(1);
    }
    expect(hasSeenNegative).toBe(true);
  });

  it('spends exactly four units after 600 additions of 0.4 / 60 thanks to the tolerance', () => {
    const world = createTestWorld({ isFilled: true });
    world.spawners.food.isEnabled = false;
    world.dnaFragments = [];
    const rate = fragmentSpawnerRates(world, DEFAULT_BALANCE).ratePerSecond;
    runSpawnersFor(world, TEN_SECONDS_TICKS);
    expect(world.dnaFragments).toHaveLength(Math.floor((rate * TEN_SECONDS_TICKS) / TICK_HZ));
  });
});

describe('spawnFoodEvent', () => {
  it('truncates a cluster to the room left under the cap', () => {
    const world = createTestWorld();
    const random = createSeededRandom(7);
    let clusterSpawned = 0;
    // Draw events until one is a cluster (bacteria), with room for only two members.
    for (let attempt = 0; attempt < 500 && clusterSpawned === 0; attempt += 1) {
      const before = world.food.length;
      const spawned = spawnFoodEvent(world, random, {
        room: 2,
        maxAttempts: ecology.SPAWN_POINT_MAX_ATTEMPTS,
        worldStage: 'protocell',
      });
      const kinds = world.food.slice(before).map((mote) => mote.kind);
      if (kinds.includes(FOOD_KIND.bacterium)) clusterSpawned = spawned;
    }
    expect(clusterSpawned).toBe(2);
  });

  it('gives every cluster member one variant', () => {
    const world = createTestWorld();
    const random = createSeededRandom(7);
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const before = world.food.length;
      spawnFoodEvent(world, random, {
        room: ecology.BACTERIUM_CLUSTER_SIZE,
        maxAttempts: ecology.SPAWN_POINT_MAX_ATTEMPTS,
        worldStage: 'protocell',
      });
      const cluster = world.food.slice(before).filter((mote) => mote.kind === FOOD_KIND.bacterium);
      if (cluster.length > 1) {
        expect(new Set(cluster.map((mote) => mote.bacteriumVariant)).size).toBe(1);
        return;
      }
    }
    throw new Error('no cluster drawn in 500 events');
  });
});

describe('runInitialFill', () => {
  it('fills to exactly the fill fractions when run on an empty dish', () => {
    const world = createTestWorld();
    world.spawners.food.isEnabled = true;
    world.spawners.dnaFragments.isEnabled = true;
    const context = createTestStepContext(world);
    runInitialFill(world, context);
    expect(world.food).toHaveLength(
      Math.floor(ecology.FOOD_INITIAL_FILL_FRACTION * foodSpawnerRates(world, DEFAULT_BALANCE).cap),
    );
    expect(world.dnaFragments).toHaveLength(
      Math.floor(ecology.DNA_FRAGMENT_INITIAL_FILL_FRACTION * fragmentSpawnerRates(world, DEFAULT_BALANCE).cap),
    );
    expect(context.streams[RANDOM_STREAM.spawner].getState().position).toBeGreaterThan(0);
  });
});
