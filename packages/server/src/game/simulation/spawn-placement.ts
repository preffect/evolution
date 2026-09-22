// Safe spawn placement (docs/game-design/session.md §5.2): candidates from the `spawnPlacement` stream,
// rejected while a threat lies within `SAFE_SPAWN_RADIUS`; after `SAFE_SPAWN_MAX_ATTEMPTS`
// rejections the candidate farthest from the nearest threat is used. The rule is a clearance a
// caller may tighten: the wild seats add "no cell centre within `WILD_CELL_MIN_SPACING_WU`"
// (docs/ecology/wild-cells.md §3.3, `game/wild/wild-seats.ts`).

import {
  distanceBetween,
  uniformPointInAnnulus,
  type BalanceConfig,
  type RandomSource,
  type Vec2,
} from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';

/**
 * How far a candidate is from rejection: ≥ 0 is safe, and when no candidate is, the largest wins
 * (the "farthest from the nearest threat" fallback, generalised).
 */
export type SpawnClearance = (point: Vec2, cells: readonly CellRecord[], balance: BalanceConfig) => number;

/** The radius of the placement disc, `DISH_RADIUS − SPAWN_EDGE_MARGIN`: cells spawn in it and the wild wander stays in it. */
export function spawnReach(balance: BalanceConfig): number {
  return balance.world.DISH_RADIUS - balance.world.SPAWN_EDGE_MARGIN;
}

/** Uniform in the disc of radius `spawnReach`; two draws. */
export function drawSpawnCandidate(random: RandomSource, balance: BalanceConfig): Vec2 {
  const reach = spawnReach(balance);
  return uniformPointInAnnulus(0, reach, random.nextFloat(), random.nextFloat());
}

export function isThreat(cell: CellRecord, balance: BalanceConfig): boolean {
  return cell.mass >= balance.world.SAFE_SPAWN_THREAT_MASS_RATIO * balance.growth.CELL_STARTING_MASS;
}

function nearestDistance(point: Vec2, cells: readonly CellRecord[], isCounted: (cell: CellRecord) => boolean): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const cell of cells) {
    if (isCounted(cell)) {
      nearest = Math.min(nearest, distanceBetween(point, cell));
    }
  }
  return nearest;
}

/** Distance to the nearest threatening cell; `Infinity` when none threatens. */
export function nearestThreatDistance(point: Vec2, cells: readonly CellRecord[], balance: BalanceConfig): number {
  return nearestDistance(point, cells, (cell) => isThreat(cell, balance));
}

/** Distance to the nearest cell centre of any kind; `Infinity` in an empty dish. */
export function nearestCellDistance(point: Vec2, cells: readonly CellRecord[]): number {
  return nearestDistance(point, cells, () => true);
}

/** The player rule: safe once the nearest threat is `SAFE_SPAWN_RADIUS` away. */
export const threatClearance: SpawnClearance = (point, cells, balance) =>
  nearestThreatDistance(point, cells, balance) - balance.world.SAFE_SPAWN_RADIUS;

export function findSafeSpawnPoint(
  random: RandomSource,
  cells: readonly CellRecord[],
  balance: BalanceConfig,
  clearance: SpawnClearance = threatClearance,
): Vec2 {
  const maxAttempts = balance.world.SAFE_SPAWN_MAX_ATTEMPTS;
  let best = drawSpawnCandidate(random, balance);
  let bestClearance = clearance(best, cells, balance);
  for (let attempt = 1; attempt < maxAttempts && bestClearance < 0; attempt += 1) {
    const candidate = drawSpawnCandidate(random, balance);
    const candidateClearance = clearance(candidate, cells, balance);
    if (candidateClearance > bestClearance) {
      best = candidate;
      bestClearance = candidateClearance;
    }
  }
  return best;
}
