// Caps and rates of the two spawners (docs/ECOLOGY.md §3): re-evaluated every tick from the
// cells in the dish and the bloom flag, so joins, leaves and the bloom take effect immediately.

import { FOOD_KIND, type BalanceConfig, type CellStage } from '@evolution/shared';
import type { WorldState } from '../world/world-state.js';
import { isBloomActive } from './round-clock.js';

export interface SpawnerRates {
  readonly cap: number;
  readonly ratePerSecond: number;
}

/** "players" = cells currently in the dish (connected or in disconnect grace). */
export function cellsInDish(world: WorldState): number {
  return world.cells.length;
}

export function foodSpawnerRates(world: WorldState, balance: BalanceConfig): SpawnerRates {
  const { ecology } = balance;
  const players = cellsInDish(world);
  const bloom = isBloomActive(world, balance) ? ecology.FOOD_BLOOM_SPAWN_MULTIPLIER : 1;
  return {
    cap: ecology.FOOD_CAP_BASE + ecology.FOOD_CAP_PER_PLAYER * players,
    ratePerSecond: (ecology.FOOD_SPAWN_PER_SECOND_BASE + ecology.FOOD_SPAWN_PER_SECOND_PER_PLAYER * players) * bloom,
  };
}

export function fragmentSpawnerRates(world: WorldState, balance: BalanceConfig): SpawnerRates {
  const { ecology } = balance;
  const players = cellsInDish(world);
  const bloom = isBloomActive(world, balance) ? ecology.DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER : 1;
  return {
    cap: ecology.DNA_FRAGMENT_CAP_BASE + ecology.DNA_FRAGMENT_CAP_PER_PLAYER * players,
    ratePerSecond:
      (ecology.DNA_FRAGMENT_SPAWN_PER_SECOND_BASE + ecology.DNA_FRAGMENT_SPAWN_PER_SECOND_PER_PLAYER * players) * bloom,
  };
}

/**
 * The per-event kind weights: `FOOD_KIND_WEIGHTS_BY_WORLD_STAGE[worldStage]` are per-mote shares
 * and a bacterium event spawns a whole cluster, so its event weight is the share over the cluster
 * size (docs/ECOLOGY.md §3, §3.2: 0.75 : 0.05 in the protocell era, renormalised by the draw).
 * Index 0 is algae, index 1 a bacterium cluster.
 */
export function spawnEventKindWeights(balance: BalanceConfig, worldStage: CellStage): readonly [number, number] {
  const shares = balance.ecology.FOOD_KIND_WEIGHTS_BY_WORLD_STAGE[worldStage];
  return [shares[FOOD_KIND.algae], shares[FOOD_KIND.bacterium] / balance.ecology.BACTERIUM_CLUSTER_SIZE];
}
