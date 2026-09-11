// Safe spawn placement (docs/GAME-DESIGN.md §5.2): candidates from the `spawnPlacement` stream,
// rejected while a threat lies within `SAFE_SPAWN_RADIUS`; after `SAFE_SPAWN_MAX_ATTEMPTS`
// rejections the candidate farthest from the nearest threat is used.

import {
  distanceBetween,
  uniformPointInAnnulus,
  type BalanceConfig,
  type RandomSource,
  type Vec2,
} from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';

/** Uniform in the disc of radius `DISH_RADIUS − SPAWN_EDGE_MARGIN`; two draws. */
export function drawSpawnCandidate(random: RandomSource, balance: BalanceConfig): Vec2 {
  const reach = balance.world.DISH_RADIUS - balance.world.SPAWN_EDGE_MARGIN;
  return uniformPointInAnnulus(0, reach, random.nextFloat(), random.nextFloat());
}

export function isThreat(cell: CellRecord, balance: BalanceConfig): boolean {
  return cell.mass >= balance.world.SAFE_SPAWN_THREAT_MASS_RATIO * balance.growth.CELL_STARTING_MASS;
}

/** Distance to the nearest threatening cell; `Infinity` when none threatens. */
export function nearestThreatDistance(point: Vec2, cells: readonly CellRecord[], balance: BalanceConfig): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const cell of cells) {
    if (isThreat(cell, balance)) {
      nearest = Math.min(nearest, distanceBetween(point, cell));
    }
  }
  return nearest;
}

export function findSafeSpawnPoint(random: RandomSource, cells: readonly CellRecord[], balance: BalanceConfig): Vec2 {
  const maxAttempts = balance.world.SAFE_SPAWN_MAX_ATTEMPTS;
  const safeRadius = balance.world.SAFE_SPAWN_RADIUS;
  let best = drawSpawnCandidate(random, balance);
  let bestDistance = nearestThreatDistance(best, cells, balance);
  for (let attempt = 1; attempt < maxAttempts && bestDistance < safeRadius; attempt += 1) {
    const candidate = drawSpawnCandidate(random, balance);
    const distance = nearestThreatDistance(candidate, cells, balance);
    if (distance > bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}
