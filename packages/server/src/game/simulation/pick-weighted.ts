// One weighted draw over a list (docs/DETERMINISM.md §3): the caller passes the items and how each
// weighs, the source picks the index. The one home of the parallel-array lookup every table draw
// in the spawner needs (kind, zone, variant, tag).

import type { RandomSource } from '@evolution/shared';
import { SimulationInvariantError } from '../world/lookups.js';

export function pickWeighted<Item>(
  random: RandomSource,
  items: readonly Item[],
  weightOf: (item: Item) => number,
): Item {
  const picked = items[random.weightedIndex(items.map(weightOf))];
  if (picked === undefined) {
    throw new SimulationInvariantError('a weighted draw over an empty list');
  }
  return picked;
}
