// Where a mote or a fragment may appear (docs/ECOLOGY.md §3): a uniform point in the drawn zone,
// rejected within `FOOD_EDGE_MARGIN` of the wall or inside any cell, redrawn up to a bound.

import {
  distanceBetween,
  uniformPointInDiscAround,
  type BalanceConfig,
  type RandomSource,
  type SpawnZoneId,
  type Vec2,
} from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';
import { pointInZone } from './zones.js';

export interface SpawnPointWorld {
  readonly cells: readonly CellRecord[];
  readonly balance: BalanceConfig;
}

export function isInsideAnyCell(point: Vec2, cells: readonly CellRecord[]): boolean {
  return cells.some((cell) => distanceBetween(point, cell) <= cell.radius);
}

/** Not within `FOOD_EDGE_MARGIN` of the wall and not inside any cell. */
export function isSpawnablePoint(point: Vec2, world: SpawnPointWorld): boolean {
  const reach = world.balance.world.DISH_RADIUS - world.balance.world.FOOD_EDGE_MARGIN;
  return Math.hypot(point.x, point.y) <= reach && !isInsideAnyCell(point, world.cells);
}

/** Redraws `draw` until `isSpawnablePoint` accepts it, at most `maxAttempts` times; `null` when it never does. */
export function drawSpawnablePoint(world: SpawnPointWorld, maxAttempts: number, draw: () => Vec2): Vec2 | null {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const point = draw();
    if (isSpawnablePoint(point, world)) {
      return point;
    }
  }
  return null;
}

/** A spawnable point uniform in `zone`. */
export function drawPointInZone(
  world: SpawnPointWorld,
  zone: SpawnZoneId,
  random: RandomSource,
  maxAttempts: number,
): Vec2 | null {
  return drawSpawnablePoint(world, maxAttempts, () =>
    pointInZone(zone, world.balance, random.nextFloat(), random.nextFloat()),
  );
}

/** The disc a cluster member is drawn in. */
export interface SpawnDisc {
  readonly centre: Vec2;
  readonly radius: number;
}

/** A spawnable point uniform in `disc` (a cluster member). */
export function drawPointAround(
  world: SpawnPointWorld,
  disc: SpawnDisc,
  random: RandomSource,
  maxAttempts: number,
): Vec2 | null {
  return drawSpawnablePoint(world, maxAttempts, () =>
    uniformPointInDiscAround(disc.centre, disc.radius, random.nextFloat(), random.nextFloat()),
  );
}
