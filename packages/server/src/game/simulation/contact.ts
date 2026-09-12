// Cell-to-cell contact (docs/ECOLOGY.md §5.3): two overlapping cells where neither can engulf the
// other are pushed apart along the centre line by `CELL_SEPARATION_FRACTION_PER_TICK` of the
// overlap, split by inverse mass (the lighter cell moves more). Pairs are walked id-sorted
// (docs/DETERMINISM.md §4). A predator and its current prey are left alone until payout or release
// (E16), and a pair inside a spit-out refractory is separated as if neither could engulf the other,
// so a spat-out prey is pushed clear (T4). Engulf contact lives here too: it is the one geometric
// test the engulf step shares with nothing else.

import { canEngulf, distanceBetween, type BalanceConfig } from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';
import { compareEntityIds } from '../world/entity-ids.js';
import type { WorldState } from '../world/world-state.js';
import { hasSpitOutRefractory } from './engulf-spit-out.js';

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

/**
 * Engulf contact (docs/ECOLOGY.md §6.1): the predator's membrane lies over the prey's centre, at
 * `|centres| ≤ predator.radius − prey.radius × ENGULF_COVERAGE_FRACTION`. Directional: covering is
 * not being covered.
 */
export function isEngulfContact(predator: CellRecord, prey: CellRecord, balance: BalanceConfig): boolean {
  const reach = predator.radius - prey.radius * balance.absorption.ENGULF_COVERAGE_FRACTION;
  return distanceBetween(predator, prey) <= reach;
}

/** Mass alone, plus the refractory: a predator that just spat this prey out cannot engulf it yet. */
function couldEngulf(predator: CellRecord, prey: CellRecord, world: WorldState, balance: BalanceConfig): boolean {
  return canEngulf(predator, prey, balance.absorption) && !hasSpitOutRefractory(predator, prey.id, world.tick);
}

/** Either cell could start on the other: the pair separation leaves alone (docs/ECOLOGY.md §5.3). */
export function isEngulfPossible(pair: CellPair, world: WorldState, balance: BalanceConfig): boolean {
  return couldEngulf(pair.lower, pair.higher, world, balance) || couldEngulf(pair.higher, pair.lower, world, balance);
}

/** A predator and the prey it is holding right now, whatever the mass ratio has drifted to (E16). */
export function isEngulfInProgress(pair: CellPair): boolean {
  return pair.lower.engulfingCellId === pair.higher.id || pair.higher.engulfingCellId === pair.lower.id;
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
    if (overlap > 0 && !isEngulfInProgress(pair) && !isEngulfPossible(pair, world, balance)) {
      pushApart(pair, overlap, balance);
    }
  }
}
