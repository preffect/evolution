// Cell-to-cell contact (docs/ECOLOGY.md §5.3): two overlapping cells where neither can engulf the
// other are pushed apart along the centre line by `CELL_SEPARATION_FRACTION_PER_TICK` of the
// overlap, split by inverse mass (the lighter cell moves more). Pairs are walked id-sorted
// (docs/DETERMINISM.md §4). A predator and its prey are left alone: the engulf slice adds that
// exclusion where the pair filter is.

import { canEngulf, distanceBetween, type BalanceConfig } from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';
import { compareEntityIds } from '../world/entity-ids.js';
import type { WorldState } from '../world/world-state.js';

export interface CellPair {
  readonly lower: CellRecord;
  readonly higher: CellRecord;
}

/** Every unordered pair of cells as `(lowerId, higherId)`, in lower-then-higher id order. */
export function cellPairs(cells: readonly CellRecord[]): CellPair[] {
  const sorted = [...cells].sort((left, right) => compareEntityIds(left.id, right.id));
  const pairs: CellPair[] = [];
  for (let first = 0; first < sorted.length; first += 1) {
    for (let second = first + 1; second < sorted.length; second += 1) {
      pairs.push({ lower: sorted[first] as CellRecord, higher: sorted[second] as CellRecord });
    }
  }
  return pairs;
}

export function isEngulfPossible(pair: CellPair, balance: BalanceConfig): boolean {
  return (
    canEngulf(pair.lower, pair.higher, balance.absorption) || canEngulf(pair.higher, pair.lower, balance.absorption)
  );
}

function pushApart(pair: CellPair, overlap: number, balance: BalanceConfig): void {
  const { lower, higher } = pair;
  const distance = distanceBetween(lower, higher);
  // Coincident centres have no line to push along; the next tick's movement separates them.
  if (distance === 0) {
    return;
  }
  const shift = overlap * balance.growth.CELL_SEPARATION_FRACTION_PER_TICK;
  const unitX = (higher.x - lower.x) / distance;
  const unitY = (higher.y - lower.y) / distance;
  const totalMass = lower.mass + higher.mass;
  const lowerShare = higher.mass / totalMass;
  const higherShare = lower.mass / totalMass;
  lower.x -= unitX * shift * lowerShare;
  lower.y -= unitY * shift * lowerShare;
  higher.x += unitX * shift * higherShare;
  higher.y += unitY * shift * higherShare;
}

export function separateOverlappingCells(world: WorldState, balance: BalanceConfig): void {
  for (const pair of cellPairs(world.cells)) {
    const overlap = pair.lower.radius + pair.higher.radius - distanceBetween(pair.lower, pair.higher);
    if (overlap > 0 && !isEngulfPossible(pair, balance)) {
      pushApart(pair, overlap, balance);
    }
  }
}
