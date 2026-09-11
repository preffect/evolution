// docs/ECOLOGY.md §3: caps, rates, the bloom and the cluster-adjusted event weights.
import { describe, expect, it } from 'vitest';
import { CELL_STAGE, DEFAULT_BALANCE } from '@evolution/shared';
import { createTestWorld } from '../../testing/world-builders.js';
import { bloomStartTick } from './round-clock.js';
import { cellsInDish, foodSpawnerRates, fragmentSpawnerRates, spawnEventKindWeights } from './spawn-rates.js';

const { ecology } = DEFAULT_BALANCE;

describe('spawner rates', () => {
  it('scale the caps and rates by the cells in the dish', () => {
    const world = createTestWorld();
    expect(cellsInDish(world)).toBe(1);
    expect(foodSpawnerRates(world, DEFAULT_BALANCE)).toEqual({
      cap: ecology.FOOD_CAP_BASE + ecology.FOOD_CAP_PER_PLAYER,
      ratePerSecond: ecology.FOOD_SPAWN_PER_SECOND_BASE + ecology.FOOD_SPAWN_PER_SECOND_PER_PLAYER,
    });
    expect(fragmentSpawnerRates(world, DEFAULT_BALANCE)).toEqual({
      cap: ecology.DNA_FRAGMENT_CAP_BASE + ecology.DNA_FRAGMENT_CAP_PER_PLAYER,
      ratePerSecond: ecology.DNA_FRAGMENT_SPAWN_PER_SECOND_BASE + ecology.DNA_FRAGMENT_SPAWN_PER_SECOND_PER_PLAYER,
    });
    world.cells = [];
    expect(foodSpawnerRates(world, DEFAULT_BALANCE).cap).toBe(ecology.FOOD_CAP_BASE);
  });

  it('multiply the rates, not the caps, during the bloom', () => {
    const world = createTestWorld();
    const before = foodSpawnerRates(world, DEFAULT_BALANCE);
    world.tick = bloomStartTick(world, DEFAULT_BALANCE);
    const bloom = foodSpawnerRates(world, DEFAULT_BALANCE);
    expect(bloom.cap).toBe(before.cap);
    expect(bloom.ratePerSecond).toBeCloseTo(before.ratePerSecond * ecology.FOOD_BLOOM_SPAWN_MULTIPLIER, 12);
    const fragments = fragmentSpawnerRates(world, DEFAULT_BALANCE);
    expect(fragments.ratePerSecond).toBeCloseTo(
      (ecology.DNA_FRAGMENT_SPAWN_PER_SECOND_BASE + ecology.DNA_FRAGMENT_SPAWN_PER_SECOND_PER_PLAYER) *
        ecology.DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER,
      12,
    );
  });
});

describe('spawnEventKindWeights', () => {
  it('is the per-mote algae share of the world stage against the bacterium share over the cluster size', () => {
    expect(spawnEventKindWeights(DEFAULT_BALANCE, CELL_STAGE.protocell)).toEqual({ algae: 0.75, bacterium: 0.05 });
    expect(spawnEventKindWeights(DEFAULT_BALANCE, CELL_STAGE.eukaryote)).toEqual({ algae: 0.5, bacterium: 0.1 });
  });
});
