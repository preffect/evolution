// A uniform grid over positioned entities (docs/ARCHITECTURE.md §3.3): rebuilt every tick,
// never part of the state. `queryCircle` answers "whose centre lies within `radius` of a
// point", id-sorted (docs/DETERMINISM.md §4) so callers walk the hits in one order.

import type { EntityId } from '@evolution/shared';
import { sortByEntityId } from './entity-ids.js';

export interface Positioned {
  readonly id: EntityId;
  readonly x: number;
  readonly y: number;
}

const BUCKET_KEY_SEPARATOR = ',';

function bucketKey(column: number, row: number): string {
  return `${column}${BUCKET_KEY_SEPARATOR}${row}`;
}

export class SpatialHash<Item extends Positioned> {
  private readonly buckets = new Map<string, Item[]>();

  constructor(private readonly cellSizeWu: number) {}

  insert(item: Item): void {
    const key = bucketKey(this.bucketIndexOf(item.x), this.bucketIndexOf(item.y));
    const bucket = this.buckets.get(key);
    if (bucket === undefined) {
      this.buckets.set(key, [item]);
    } else {
      bucket.push(item);
    }
  }

  insertAll(items: readonly Item[]): void {
    for (const item of items) {
      this.insert(item);
    }
  }

  /** Every item whose centre is within `radius` (inclusive) of `(x, y)`, sorted by id. */
  queryCircle(x: number, y: number, radius: number): Item[] {
    const hits: Item[] = [];
    const radiusSquared = radius * radius;
    const minColumn = this.bucketIndexOf(x - radius);
    const maxColumn = this.bucketIndexOf(x + radius);
    const minRow = this.bucketIndexOf(y - radius);
    const maxRow = this.bucketIndexOf(y + radius);
    for (let column = minColumn; column <= maxColumn; column += 1) {
      for (let row = minRow; row <= maxRow; row += 1) {
        this.collectWithin(bucketKey(column, row), { x, y, radiusSquared }, hits);
      }
    }
    return sortByEntityId(hits);
  }

  private collectWithin(key: string, circle: { x: number; y: number; radiusSquared: number }, hits: Item[]): void {
    const bucket = this.buckets.get(key);
    if (bucket === undefined) {
      return;
    }
    for (const item of bucket) {
      const deltaX = item.x - circle.x;
      const deltaY = item.y - circle.y;
      if (deltaX * deltaX + deltaY * deltaY <= circle.radiusSquared) {
        hits.push(item);
      }
    }
  }

  /** The bucket index along one axis (a column for x, a row for y); negative coordinates floor downward. */
  private bucketIndexOf(coordinate: number): number {
    return Math.floor(coordinate / this.cellSizeWu);
  }
}
