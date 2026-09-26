// docs/ecology/mass-and-movement.md §5.3 (E10 first half): separation of cells that cannot engulf each other, alone
// and through the whole movement step, where an idle cell has no target to steer back to (§5.2, #261).
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, playerId } from '@evolution/shared';
import { BROTH_POINT } from '../../testing/gameplay/placement.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import type { CellRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';
import { setCellMass } from './cell-mass.js';
import { cellPairs, isEngulfPossible, separateOverlappingCells } from './contact.js';
import { moveCells } from './movement.js';

const CENTRE_DISTANCE = 10;
/** E10's run length and its stated bound, `A.radius + B.radius − distance` < 0.01 wu. */
const SEPARATION_TICKS = 120;
const OVERLAP_BOUND_WU = 0.01;
/** How far past A a crossed B lands on the start-of-tick line (#709). */
const CROSSED_BY_WU = 2;
/** A 24 / 20 pair this far apart overlaps shallowly: the fraction's push leaves it well past the minimum distance. */
const SHALLOW_CENTRE_DISTANCE = 30;
/** How far past the minimum distance a pair just short of the depth cap lands (#709). */
const PAST_MINIMUM_WU = 0.5;
/** Just short of crossing: B still this far ahead of A along the start line (#709). */
const SHORT_OF_CROSSING_WU = 0.5;
/** B's sideways offset in the just-short-of-crossing row, so its centre line differs from the start line. */
const SIDEWAYS_WU = 6;
const { CELL_SEPARATION_FRACTION_PER_TICK: SEPARATION_FRACTION, CELL_MIN_CENTRE_DISTANCE_FRACTION: MINIMUM_FRACTION } =
  DEFAULT_BALANCE.growth;

function twoCells(massA: number, massB: number): { world: WorldState; cellA: CellRecord; cellB: CellRecord } {
  const world = createTestWorld({
    players: [
      { playerId: playerId('a'), playerName: 'A', avatarIndex: 0 },
      { playerId: playerId('b'), playerName: 'B', avatarIndex: 1 },
    ],
  });
  const [cellA, cellB] = world.cells as [CellRecord, CellRecord];
  for (const [cell, mass, offset] of [
    [cellA, massA, 0],
    [cellB, massB, CENTRE_DISTANCE],
  ] as const) {
    cell.x = BROTH_POINT.x + offset;
    cell.y = BROTH_POINT.y;
    setCellMass(cell, mass, DEFAULT_BALANCE);
  }
  return { world, cellA, cellB };
}

const overlapOf = (cellA: CellRecord, cellB: CellRecord): number =>
  cellA.radius + cellB.radius - Math.hypot(cellA.x - cellB.x, cellA.y - cellB.y);

/** What `SEPARATION_TICKS` of separation alone leave of an overlap: `× (1 − CELL_SEPARATION_FRACTION_PER_TICK)` a tick. */
const separatedOverlapOf = (initialOverlap: number): number =>
  initialOverlap * (1 - DEFAULT_BALANCE.growth.CELL_SEPARATION_FRACTION_PER_TICK) ** SEPARATION_TICKS;

describe('separateOverlappingCells', () => {
  it('E10: 120 ticks of separation push a 24 / 20 pair apart to under 0.01 wu of overlap (masses held)', () => {
    const { world, cellA, cellB } = twoCells(24, 20);
    const initialOverlap = overlapOf(cellA, cellB);
    for (let tick = 0; tick < SEPARATION_TICKS; tick += 1) separateOverlappingCells(world, DEFAULT_BALANCE);
    expect(overlapOf(cellA, cellB)).toBeLessThan(OVERLAP_BOUND_WU);
    expect(overlapOf(cellA, cellB)).toBeCloseTo(separatedOverlapOf(initialOverlap), 6);
  });

  it('E10 through the whole step: an idle pair with no target is pushed apart and nothing steers it back', () => {
    const { world, cellA, cellB } = twoCells(24, 20);
    expect([cellA.targetX, cellB.targetX]).toEqual([null, null]);
    const initialOverlap = overlapOf(cellA, cellB);
    const context = createTestStepContext(world);
    for (let tick = 0; tick < SEPARATION_TICKS; tick += 1) moveCells(world, context);
    expect(overlapOf(cellA, cellB)).toBeLessThan(OVERLAP_BOUND_WU);
    expect(overlapOf(cellA, cellB)).toBeCloseTo(separatedOverlapOf(initialOverlap), 6);
    expect([cellA.velocityX, cellB.velocityX]).toEqual([0, 0]);
  });

  it('a latched target still pulls a pushed cell back once it leaves the dead zone', () => {
    const { world, cellA, cellB } = twoCells(24, 20);
    const placedXOfB = cellB.x;
    for (const cell of [cellA, cellB]) {
      cell.targetX = cell.x;
      cell.targetY = cell.y;
    }
    const context = createTestStepContext(world);
    for (let tick = 0; tick < SEPARATION_TICKS; tick += 1) moveCells(world, context);
    expect(overlapOf(cellA, cellB)).toBeGreaterThan(OVERLAP_BOUND_WU);
    expect(cellB.x - placedXOfB).toBeGreaterThan(DEFAULT_BALANCE.controls.STEER_DEAD_ZONE_RADII * cellB.radius);
  });

  it('runs inside the movement step, before the pins are restored', () => {
    const { world, cellA, cellB } = twoCells(24, 20);
    cellA.pinnedX = cellA.x;
    cellA.pinnedY = cellA.y;
    const context = createTestStepContext(world);
    moveCells(world, context);
    expect(cellA.x).toBe(BROTH_POINT.x);
    expect(cellB.x).toBeGreaterThan(BROTH_POINT.x + CENTRE_DISTANCE);
  });

  it('moves the lighter cell more, by inverse mass, along the centre line', () => {
    const { world, cellA, cellB } = twoCells(24, 20);
    cellB.x = BROTH_POINT.x + SHALLOW_CENTRE_DISTANCE;
    const startA = cellA.x;
    const startB = cellB.x;
    const overlap = overlapOf(cellA, cellB);
    separateOverlappingCells(world, DEFAULT_BALANCE);
    const shiftA = startA - cellA.x;
    const shiftB = cellB.x - startB;
    expect(shiftA).toBeGreaterThan(0);
    expect(shiftB).toBeCloseTo(shiftA * (24 / 20), 9);
    expect(shiftA + shiftB).toBeCloseTo(overlap * DEFAULT_BALANCE.growth.CELL_SEPARATION_FRACTION_PER_TICK, 9);
    expect(cellA.y).toBe(BROTH_POINT.y);
  });

  it('leaves an engulf-eligible pair alone', () => {
    const { world, cellA, cellB } = twoCells(100, 20);
    expect(isEngulfPossible({ lower: cellA, higher: cellB }, world, DEFAULT_BALANCE)).toBe(true);
    const before = [cellA.x, cellB.x];
    separateOverlappingCells(world, DEFAULT_BALANCE);
    expect([cellA.x, cellB.x]).toEqual(before);
  });

  it('respects the prey membrane bonus in the eligibility check', () => {
    const { world, cellA, cellB } = twoCells(26, 20);
    expect(isEngulfPossible({ lower: cellA, higher: cellB }, world, DEFAULT_BALANCE)).toBe(true);
    cellB.membraneRatioBonus = 0.15;
    expect(isEngulfPossible({ lower: cellA, higher: cellB }, world, DEFAULT_BALANCE)).toBe(false);
  });

  it('does nothing for coincident centres or non-overlapping cells', () => {
    const { world, cellA, cellB } = twoCells(24, 20);
    cellB.x = cellA.x;
    separateOverlappingCells(world, DEFAULT_BALANCE);
    expect(cellB.x).toBe(cellA.x);
    cellB.x = cellA.x + 1000;
    separateOverlappingCells(world, DEFAULT_BALANCE);
    expect(cellB.x).toBe(cellA.x + 1000);
  });
});

describe('separateOverlappingCells: a pair whose centres crossed this tick (#709)', () => {
  /** Where a crossed pair ends: the minimum centre distance, which is past the fraction's push from coincident centres. */
  const minimumOf = (cellA: CellRecord, cellB: CellRecord): number =>
    (cellA.radius + cellB.radius) * Math.max(SEPARATION_FRACTION, MINIMUM_FRACTION);
  /** A at the broth point, B `CENTRE_DISTANCE` east of it at the start of the tick. */
  const startCentresOf = (cellA: CellRecord, cellB: CellRecord) =>
    new Map([
      [cellA, { x: BROTH_POINT.x, y: BROTH_POINT.y }],
      [cellB, { x: BROTH_POINT.x + CENTRE_DISTANCE, y: BROTH_POINT.y }],
    ]);

  it('pushes a head-on crossed pair back to its own sides, to the minimum centre distance, by inverse mass', () => {
    const { world, cellA, cellB } = twoCells(24, 20);
    const startCentres = startCentresOf(cellA, cellB);
    cellB.x = BROTH_POINT.x - CROSSED_BY_WU;
    separateOverlappingCells(world, DEFAULT_BALANCE, startCentres);
    const shiftA = BROTH_POINT.x - cellA.x;
    const shiftB = cellB.x - (BROTH_POINT.x - CROSSED_BY_WU);
    expect(cellB.x - cellA.x).toBeCloseTo(minimumOf(cellA, cellB), 9);
    expect(shiftB).toBeCloseTo(shiftA * (24 / 20), 9);
    expect([cellA.y, cellB.y]).toEqual([BROTH_POINT.y, BROTH_POINT.y]);
  });

  it('without the start centres the same pair is pushed out the far side (the #709 fault)', () => {
    const { world, cellA, cellB } = twoCells(24, 20);
    cellB.x = BROTH_POINT.x - CROSSED_BY_WU;
    separateOverlappingCells(world, DEFAULT_BALANCE);
    expect(cellB.x).toBeLessThan(cellA.x);
  });

  it('treats a glancing pass, still ahead along the start line, as ordinary separation', () => {
    const { world, cellA, cellB } = twoCells(20, 20);
    const startCentres = startCentresOf(cellA, cellB);
    cellB.y = BROTH_POINT.y + CENTRE_DISTANCE;
    const overlap = overlapOf(cellA, cellB);
    separateOverlappingCells(world, DEFAULT_BALANCE, startCentres);
    expect(cellB.x - cellA.x).toBeCloseTo(CENTRE_DISTANCE + (overlap * SEPARATION_FRACTION) / Math.SQRT2, 9);
    expect(cellB.y - cellA.y).toBeCloseTo(CENTRE_DISTANCE + (overlap * SEPARATION_FRACTION) / Math.SQRT2, 9);
  });

  it('separates a pair just short of crossing along its own centre line, not the start line', () => {
    const { world, cellA, cellB } = twoCells(20, 20);
    const startCentres = startCentresOf(cellA, cellB);
    cellB.x = BROTH_POINT.x + SHORT_OF_CROSSING_WU;
    cellB.y = BROTH_POINT.y + SIDEWAYS_WU;
    separateOverlappingCells(world, DEFAULT_BALANCE, startCentres);
    const offset = { x: cellB.x - cellA.x, y: cellB.y - cellA.y };
    expect(offset.x * SIDEWAYS_WU - offset.y * SHORT_OF_CROSSING_WU).toBeCloseTo(0, 9);
    expect(Math.hypot(offset.x, offset.y)).toBeCloseTo((cellA.radius + cellB.radius) * MINIMUM_FRACTION, 9);
  });

  it('leaves a pair alone that passed out of reach across the start line', () => {
    const { world, cellA, cellB } = twoCells(20, 20);
    const startCentres = startCentresOf(cellA, cellB);
    cellB.x = BROTH_POINT.x - CROSSED_BY_WU;
    cellB.y = BROTH_POINT.y + (cellA.radius + cellB.radius) * 2;
    const before = [cellB.x, cellB.y];
    separateOverlappingCells(world, DEFAULT_BALANCE, startCentres);
    expect([cellB.x, cellB.y]).toEqual(before);
  });

  it('leaves a crossed engulf-eligible pair alone', () => {
    const { world, cellA, cellB } = twoCells(100, 20);
    const startCentres = startCentresOf(cellA, cellB);
    cellB.x = BROTH_POINT.x - CROSSED_BY_WU;
    separateOverlappingCells(world, DEFAULT_BALANCE, startCentres);
    expect([cellA.x, cellB.x]).toEqual([BROTH_POINT.x, BROTH_POINT.x - CROSSED_BY_WU]);
  });

  it('pushes back a pair that tunnelled clean through, out of contact on the far side', () => {
    const { world, cellA, cellB } = twoCells(20, 20);
    const startCentres = startCentresOf(cellA, cellB);
    cellB.x = BROTH_POINT.x - (cellA.radius + cellB.radius) * 2;
    separateOverlappingCells(world, DEFAULT_BALANCE, startCentres);
    expect(cellB.x - cellA.x).toBeCloseTo(minimumOf(cellA, cellB), 9);
  });
});

describe('separateOverlappingCells: the minimum centre distance (#709)', () => {
  it('pushes a pair deeper than the cap out to exactly the minimum centre distance, by inverse mass', () => {
    const { world, cellA, cellB } = twoCells(24, 20);
    separateOverlappingCells(world, DEFAULT_BALANCE);
    const shiftA = BROTH_POINT.x - cellA.x;
    const shiftB = cellB.x - (BROTH_POINT.x + CENTRE_DISTANCE);
    expect(cellB.x - cellA.x).toBeCloseTo((cellA.radius + cellB.radius) * MINIMUM_FRACTION, 9);
    expect(shiftB).toBeCloseTo(shiftA * (24 / 20), 9);
  });

  it('gives a pair just short of the cap the fraction of its overlap and no more', () => {
    const { world, cellA, cellB } = twoCells(20, 20);
    const radii = cellA.radius + cellB.radius;
    // d + f × (radii − d) = minimum + PAST_MINIMUM_WU, solved for the start distance d.
    const startDistance =
      ((MINIMUM_FRACTION - SEPARATION_FRACTION) * radii + PAST_MINIMUM_WU) / (1 - SEPARATION_FRACTION);
    cellB.x = BROTH_POINT.x + startDistance;
    separateOverlappingCells(world, DEFAULT_BALANCE);
    expect(cellB.x - cellA.x).toBeCloseTo(radii * MINIMUM_FRACTION + PAST_MINIMUM_WU, 9);
  });
});

describe('cellPairs', () => {
  it('lists every unordered pair as (lowerId, higherId) in id order regardless of array order', () => {
    const { world, cellA, cellB } = twoCells(20, 20);
    world.cells = [cellB, cellA];
    const pairs = cellPairs(world.cells);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.lower).toBe(cellA);
    expect(pairs[0]!.higher).toBe(cellB);
    expect(cellPairs([cellA])).toEqual([]);
  });
});
