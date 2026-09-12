// docs/ECOLOGY.md §5.3 (E10 first half): separation of cells that cannot engulf each other.
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
    cell.targetX = cell.x;
    cell.targetY = cell.y;
    setCellMass(cell, mass, DEFAULT_BALANCE);
  }
  return { world, cellA, cellB };
}

const overlapOf = (cellA: CellRecord, cellB: CellRecord): number =>
  cellA.radius + cellB.radius - Math.hypot(cellA.x - cellB.x, cellA.y - cellB.y);

describe('separateOverlappingCells', () => {
  it('E10: 120 ticks of separation push a 24 / 20 pair apart to under 0.01 wu of overlap (masses held)', () => {
    const { world, cellA, cellB } = twoCells(24, 20);
    const initialOverlap = overlapOf(cellA, cellB);
    for (let tick = 0; tick < 120; tick += 1) separateOverlappingCells(world, DEFAULT_BALANCE);
    expect(overlapOf(cellA, cellB)).toBeLessThan(0.01);
    expect(overlapOf(cellA, cellB)).toBeCloseTo(
      initialOverlap * (1 - DEFAULT_BALANCE.growth.CELL_SEPARATION_FRACTION_PER_TICK) ** 120,
      6,
    );
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
