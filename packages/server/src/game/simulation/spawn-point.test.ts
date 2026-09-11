import { describe, expect, it } from 'vitest';
import { createSeededRandom, DEFAULT_BALANCE, ZONE_ID } from '@evolution/shared';
import { createTestWorld } from '../../testing/world-builders.js';
import {
  drawPointAround,
  drawPointInZone,
  drawSpawnablePoint,
  isInsideAnyCell,
  isSpawnablePoint,
} from './spawn-point.js';

const SEED = 42;
const { world: worldBalance } = DEFAULT_BALANCE;

function worldWithCellAt(x: number, y: number) {
  const world = createTestWorld();
  const cell = world.cells[0]!;
  cell.x = x;
  cell.y = y;
  return { world, cell };
}

describe('isSpawnablePoint', () => {
  it('rejects points within FOOD_EDGE_MARGIN of the wall', () => {
    const { world } = worldWithCellAt(0, 0);
    const reach = worldBalance.DISH_RADIUS - worldBalance.FOOD_EDGE_MARGIN;
    expect(isSpawnablePoint({ x: reach, y: 0 }, world)).toBe(true);
    expect(isSpawnablePoint({ x: reach + 0.01, y: 0 }, world)).toBe(false);
  });

  it('rejects points inside any cell, inclusive at the radius', () => {
    const { world, cell } = worldWithCellAt(1000, 0);
    expect(isInsideAnyCell({ x: 1000 + cell.radius, y: 0 }, world.cells)).toBe(true);
    expect(isSpawnablePoint({ x: 1000 + cell.radius, y: 0 }, world)).toBe(false);
    expect(isSpawnablePoint({ x: 1000 + cell.radius + 0.01, y: 0 }, world)).toBe(true);
  });
});

describe('drawSpawnablePoint', () => {
  it('returns the first accepted draw', () => {
    const { world } = worldWithCellAt(0, 0);
    const draws = [
      { x: 0, y: 0 },
      { x: 5000, y: 0 },
      { x: 100, y: 100 },
    ];
    expect(drawSpawnablePoint(world, 10, () => draws.shift()!)).toEqual({ x: 100, y: 100 });
  });

  it('returns null after maxAttempts rejections', () => {
    const { world } = worldWithCellAt(0, 0);
    let draws = 0;
    expect(
      drawSpawnablePoint(world, 3, () => {
        draws += 1;
        return { x: 0, y: 0 };
      }),
    ).toBeNull();
    expect(draws).toBe(3);
  });
});

describe('drawPointInZone / drawPointAround', () => {
  it('draws a spawnable point inside the zone band', () => {
    const { world } = worldWithCellAt(0, 0);
    const point = drawPointInZone(world, ZONE_ID.sunlitShallows, createSeededRandom(SEED), 10);
    expect(point).not.toBeNull();
    const distance = Math.hypot(point!.x, point!.y);
    expect(distance).toBeGreaterThanOrEqual(worldBalance.DISH_RADIUS - DEFAULT_BALANCE.ecology.SHALLOWS_WIDTH);
    expect(distance).toBeLessThanOrEqual(worldBalance.DISH_RADIUS - worldBalance.FOOD_EDGE_MARGIN);
  });

  it('draws a cluster member within the radius of the centre', () => {
    const { world } = worldWithCellAt(0, 0);
    const centre = { x: 1500, y: 0 };
    const point = drawPointAround(world, { centre, radius: 60 }, createSeededRandom(SEED), 10);
    expect(point).not.toBeNull();
    expect(Math.hypot(point!.x - centre.x, point!.y - centre.y)).toBeLessThanOrEqual(60);
  });

  it('gives null for a vent fully covered by a cell', () => {
    const { world, cell } = worldWithCellAt(0, 0);
    cell.radius = DEFAULT_BALANCE.ecology.VENT_RADIUS * 2;
    expect(drawPointInZone(world, ZONE_ID.warmVent, createSeededRandom(SEED), 10)).toBeNull();
  });
});
