// docs/DETERMINISM.md §7: query results equal brute force and are id-sorted, on seeded populations.
import { describe, expect, it } from 'vitest';
import { createSeededRandom, entityId, SPATIAL_HASH_CELL_SIZE_WU, type EntityId } from '@evolution/shared';
import { compareEntityIds } from './entity-ids.js';
import { SpatialHash, type Positioned } from './spatial-hash.js';

const SEED = 42;
const POPULATION = 400;
const SPAN = 3000;

function seededPopulation(): Positioned[] {
  const random = createSeededRandom(SEED);
  const items: Positioned[] = [];
  for (let index = 0; index < POPULATION; index += 1) {
    items.push({
      id: entityId(`m-${index + 1}`),
      x: (random.nextFloat() * 2 - 1) * SPAN,
      y: (random.nextFloat() * 2 - 1) * SPAN,
    });
  }
  // Shuffled so the insertion order is not the id order.
  return random.shuffle(items);
}

function bruteForce(items: readonly Positioned[], x: number, y: number, radius: number): EntityId[] {
  return items
    .filter((item) => Math.hypot(item.x - x, item.y - y) <= radius)
    .map((item) => item.id)
    .sort(compareEntityIds);
}

describe('SpatialHash.queryCircle', () => {
  const items = seededPopulation();
  const hash = new SpatialHash<Positioned>(SPATIAL_HASH_CELL_SIZE_WU);
  hash.insertAll(items);

  it.each([
    [0, 0, 500],
    [SPATIAL_HASH_CELL_SIZE_WU, SPATIAL_HASH_CELL_SIZE_WU, 10],
    [-1234.5, 876, 700],
    [-2900, -2900, 1500],
    [150, -150, SPATIAL_HASH_CELL_SIZE_WU * 2.5],
    [2999, 0, 1],
  ])('matches brute force around (%d, %d) within %d wu, id-sorted', (x, y, radius) => {
    const hits = hash.queryCircle(x, y, radius).map((item) => item.id);
    expect(hits).toEqual(bruteForce(items, x, y, radius));
    expect(bruteForce(items, x, y, SPAN * 3).length).toBe(POPULATION);
  });

  it('is inclusive at exactly the radius and returns an empty list for an empty bucket area', () => {
    const empty = new SpatialHash<Positioned>(SPATIAL_HASH_CELL_SIZE_WU);
    empty.insert({ id: entityId('m-1'), x: 3, y: 4 });
    expect(empty.queryCircle(0, 0, 5).map((item) => item.id)).toEqual(['m-1']);
    expect(empty.queryCircle(0, 0, 4.999)).toEqual([]);
    expect(empty.queryCircle(10_000, 10_000, 1)).toEqual([]);
  });

  it('spans several buckets and negative coordinates in one query', () => {
    const spanning = new SpatialHash<Positioned>(SPATIAL_HASH_CELL_SIZE_WU);
    spanning.insertAll([
      { id: entityId('m-1'), x: -299, y: -299 },
      { id: entityId('m-2'), x: 1, y: 1 },
      { id: entityId('m-3'), x: 899, y: 0 },
    ]);
    expect(spanning.queryCircle(0, 0, 500).map((item) => item.id)).toEqual(['m-1', 'm-2']);
    expect(spanning.queryCircle(500, 0, 500).map((item) => item.id)).toEqual(['m-2', 'm-3']);
    expect(spanning.queryCircle(-600, -600, 500).map((item) => item.id)).toEqual(['m-1']);
  });

  it('returns hits sorted by id even when inserted out of order', () => {
    const small = new SpatialHash<Positioned>(SPATIAL_HASH_CELL_SIZE_WU);
    small.insert({ id: entityId('m-10'), x: 1, y: 0 });
    small.insert({ id: entityId('m-2'), x: 2, y: 0 });
    small.insert({ id: entityId('m-1'), x: 3, y: 0 });
    expect(small.queryCircle(0, 0, 10).map((item) => item.id)).toEqual(['m-1', 'm-2', 'm-10']);
  });
});
