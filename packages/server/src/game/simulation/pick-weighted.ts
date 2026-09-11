// One weighted draw over a list (docs/DETERMINISM.md §3): the caller passes the items and how each
// weighs, the source picks the index. The one home of the parallel-array lookup every table draw
// in the spawner needs (kind, zone, variant, tag).

import type { RandomSource } from '@evolution/shared';
import { SimulationInvariantError } from '../world/simulation-invariant-error.js';

export function pickWeighted<Item>(
  random: RandomSource,
  items: readonly Item[],
  weightOf: (item: Item) => number,
): Item {
  if (items.length === 0) {
    throw new SimulationInvariantError('a weighted draw over an empty list');
  }
  const index = random.weightedIndex(items.map(weightOf));
  const picked = items[index];
  if (picked === undefined) {
    throw new SimulationInvariantError(`weightedIndex answered ${index} over ${items.length} items`);
  }
  return picked;
}
