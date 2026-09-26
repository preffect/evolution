// Cell-to-cell contact (docs/ecology/mass-and-movement.md §5.3): two overlapping cells where neither can engulf the
// other are pushed apart along the centre line by `CELL_SEPARATION_FRACTION_PER_TICK` of the
// overlap, split by inverse mass (the lighter cell moves more). Pairs are walked id-sorted
// (docs/determinism/ordering-and-state-hash.md §4). A predator and its current prey are left alone until payout or release
// (E16), and a pair inside a spit-out refractory is separated as if neither could engulf the other,
// so a spat-out prey is pushed clear (T4). The push is at least enough to leave the centres
// `CELL_MIN_CENTRE_DISTANCE_FRACTION` of the radii's sum apart, and a pair whose centres crossed this tick is pushed
// back along its start-of-tick centre line instead (#709). Engulf contact lives here too: it is the one geometric
// test the engulf step shares with nothing else.

import { canEngulf, distanceBetween, type BalanceConfig, type Vec2 } from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';
import { compareEntityIds } from '../world/entity-ids.js';
import type { WorldState } from '../world/world-state.js';
import { hasSpitOutRefractory } from './engulf-spit-out.js';

/** Where a cell is and how big: all engulf contact reads. */
export type CellFootprint = Pick<CellRecord, 'x' | 'y' | 'radius'>;

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
 * Engulf contact (docs/ecology/absorption.md §6.1): the predator's membrane lies over the prey's centre, at
 * `|centres| ≤ predator.radius − prey.radius × ENGULF_COVERAGE_FRACTION`. Directional: covering is
 * not being covered.
 */
export function isEngulfContact(predator: CellFootprint, prey: CellFootprint, balance: BalanceConfig): boolean {
  return engulfContactGap(predator, prey, balance) <= 0;
}

/** How far the predator still is from engulf contact with the prey (wu); zero or less once it covers the prey. */
export function engulfContactGap(predator: CellFootprint, prey: CellFootprint, balance: BalanceConfig): number {
  const reach = predator.radius - prey.radius * balance.absorption.ENGULF_COVERAGE_FRACTION;
  return distanceBetween(predator, prey) - reach;
}

/** Mass alone, plus the refractory: a predator that just spat this prey out cannot engulf it yet. */
function couldEngulf(predator: CellRecord, prey: CellRecord, world: WorldState, balance: BalanceConfig): boolean {
  return canEngulf(predator, prey, balance.absorption) && !hasSpitOutRefractory(predator, prey.id, world.tick);
}

/** Either cell could start on the other: the pair separation leaves alone (docs/ecology/mass-and-movement.md §5.3). */
export function isEngulfPossible(pair: CellPair, world: WorldState, balance: BalanceConfig): boolean {
  return couldEngulf(pair.lower, pair.higher, world, balance) || couldEngulf(pair.higher, pair.lower, world, balance);
}

/** A predator and the prey it is holding right now, whatever the mass ratio has drifted to (E16). */
export function isEngulfInProgress(pair: CellPair): boolean {
  return pair.lower.engulfingCellId === pair.higher.id || pair.higher.engulfingCellId === pair.lower.id;
}

/** Where every cell's centre was at the start of the tick, before movement: the axis a crossed pair is pushed back along. */
export type StartCentres = ReadonlyMap<CellRecord, Vec2>;

const NO_START_CENTRES: StartCentres = new Map();

/** A pair whose centres passed each other this tick: the start-of-tick centre line and where the pair now lies on it. */
interface Crossing {
  readonly unit: Vec2;
  /** The higher cell's centre past the lower's along `unit` (wu): negative once the centres have crossed. */
  readonly along: number;
}

/**
 * Head-on crossing (docs/ecology/mass-and-movement.md §5.3, #709): the centres swapped sides of the start-of-tick
 * centre line while the pair was in reach of each other across it. A glancing pass keeps `along` positive.
 */
function crossingOf(pair: CellPair, startCentres: StartCentres): Crossing | undefined {
  const lowerStart = startCentres.get(pair.lower);
  const higherStart = startCentres.get(pair.higher);
  if (lowerStart === undefined || higherStart === undefined) {
    return undefined;
  }
  const startDistance = distanceBetween(lowerStart, higherStart);
  if (startDistance === 0) {
    return undefined;
  }
  const unit = { x: (higherStart.x - lowerStart.x) / startDistance, y: (higherStart.y - lowerStart.y) / startDistance };
  const offsetX = pair.higher.x - pair.lower.x;
  const offsetY = pair.higher.y - pair.lower.y;
  const along = offsetX * unit.x + offsetY * unit.y;
  const across = Math.abs(offsetX * unit.y - offsetY * unit.x);
  return along < 0 && across < pair.lower.radius + pair.higher.radius ? { unit, along } : undefined;
}

/** Moves the pair `shift` wu further apart along `unit` (lower → higher), split by inverse mass (the lighter moves more). */
function shiftApart(pair: CellPair, unit: Vec2, shift: number): void {
  const { lower, higher } = pair;
  const totalMass = lower.mass + higher.mass;
  const lowerShare = higher.mass / totalMass;
  const higherShare = lower.mass / totalMass;
  lower.x -= unit.x * shift * lowerShare;
  lower.y -= unit.y * shift * lowerShare;
  higher.x += unit.x * shift * higherShare;
  higher.y += unit.y * shift * higherShare;
}

/** The closest two cells that cannot engulf each other may end a tick (wu): a share of their radii's sum (§5.3). */
function minimumCentreDistanceOf(pair: CellPair, balance: BalanceConfig): number {
  return (pair.lower.radius + pair.higher.radius) * balance.growth.CELL_MIN_CENTRE_DISTANCE_FRACTION;
}

/**
 * `CELL_SEPARATION_FRACTION_PER_TICK` of the overlap, or more when that would still leave the centres closer than
 * the minimum centre distance: the depth cap that stops an off-axis pair pivoting through itself (#709).
 */
function pushApart(pair: CellPair, overlap: number, balance: BalanceConfig): void {
  const { lower, higher } = pair;
  const distance = distanceBetween(lower, higher);
  // Coincident centres have no line to push along; the next tick's movement separates them.
  if (distance === 0) {
    return;
  }
  const unit = { x: (higher.x - lower.x) / distance, y: (higher.y - lower.y) / distance };
  const fractionShift = overlap * balance.growth.CELL_SEPARATION_FRACTION_PER_TICK;
  shiftApart(pair, unit, Math.max(fractionShift, minimumCentreDistanceOf(pair, balance) - distance));
}

/**
 * A crossed pair is put back where its centres meet on the start-of-tick line, then separated from there as any pair
 * is: `CELL_SEPARATION_FRACTION_PER_TICK` of the overlap coincident centres have (the sum of the radii), or the
 * minimum centre distance when that is further.
 */
function pushBack(pair: CellPair, crossing: Crossing, balance: BalanceConfig): void {
  const radii = pair.lower.radius + pair.higher.radius;
  const fractionShift = radii * balance.growth.CELL_SEPARATION_FRACTION_PER_TICK;
  shiftApart(pair, crossing.unit, Math.max(fractionShift, minimumCentreDistanceOf(pair, balance)) - crossing.along);
}

function isSeparable(pair: CellPair, world: WorldState, balance: BalanceConfig): boolean {
  return !isEngulfInProgress(pair) && !isEngulfPossible(pair, world, balance);
}

/**
 * Separation (docs/ecology/mass-and-movement.md §5.3). Given the start-of-tick centres (movement passes them), a pair
 * whose centres crossed this tick is pushed back along its start-of-tick line instead of out the far side (#709).
 */
export function separateOverlappingCells(
  world: WorldState,
  balance: BalanceConfig,
  startCentres: StartCentres = NO_START_CENTRES,
): void {
  for (const pair of cellPairs(world.cells)) {
    const crossing = crossingOf(pair, startCentres);
    const overlap = pair.lower.radius + pair.higher.radius - distanceBetween(pair.lower, pair.higher);
    if ((crossing === undefined && overlap <= 0) || !isSeparable(pair, world, balance)) {
      continue;
    }
    if (crossing === undefined) {
      pushApart(pair, overlap, balance);
    } else {
      pushBack(pair, crossing, balance);
    }
  }
}
