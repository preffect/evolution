import { describe, expect, it } from 'vitest';
import {
  CELL_KIND,
  EFFECT_KIND,
  createTestCellView,
  createTestPlayerProgressView,
  createTestSnapshot,
  entityId,
  playerId,
} from '@evolution/shared';
import { createWildSeatRecord } from '../../game/wild/wild-seats.js';
import type { EvolutionScenarioSnapshot } from './evolution-adapter.js';
import {
  cellOf,
  distanceBetweenCells,
  effectsOfKind,
  foodCount,
  fragmentCount,
  massOf,
  progressOf,
  speedOf,
  wildCellOf,
  wildCellsOf,
  wildSeatOf,
  type EvolutionView,
} from './evolution-views.js';

const alice = playerId('player_0');
const bob = playerId('player_1');

function viewOf(snapshot: Partial<EvolutionScenarioSnapshot>): EvolutionView {
  return {
    tick: 5,
    seed: 42,
    snapshot: {
      ...createTestSnapshot(),
      spawnedCounts: { food: 0, dnaFragments: 0 },
      progressByPlayer: {},
      wildSeats: [],
      ...snapshot,
    },
    playerId: (index) => playerId(`player_${index}`),
    cell: () => undefined,
    captured: () => undefined,
  };
}

describe('evolution views', () => {
  const view = viewOf({
    cells: [
      createTestCellView({ id: entityId('c-1'), playerId: alice, x: 0, y: 0, mass: 50, velocityX: 3, velocityY: 4 }),
      createTestCellView({ id: entityId('c-2'), playerId: bob, x: 30, y: 40 }),
    ],
    progressByPlayer: { [alice]: createTestPlayerProgressView({ playerId: alice, level: 3 }) },
    dnaFragments: [{ id: entityId('f-1'), x: 1, y: 1, tag: 'motile' }],
    food: {
      spawned: [{ id: entityId('m-1'), kind: 'algae', bacteriumVariant: null, x: 0, y: 0 }],
      removedIds: [],
      moved: [],
    },
    effects: [{ kind: EFFECT_KIND.worldLevelUp, tick: 5, level: 2, stage: 'prokaryote' }],
  });

  it('reads a player index onto its cell, progress, mass and speed', () => {
    expect(cellOf(view, 0)?.id).toBe('c-1');
    expect(progressOf(view, 0)?.level).toBe(3);
    expect(massOf(view, 0)).toBe(50);
    expect(speedOf(view, 0)).toBe(5);
    expect(distanceBetweenCells(view, 0, 1)).toBe(50);
  });

  it('answers undefined for a player without a cell or a record', () => {
    expect(cellOf(view, 2)).toBeUndefined();
    expect(progressOf(view, 1)).toBeUndefined();
    expect(massOf(view, 2)).toBeUndefined();
    expect(speedOf(view, 2)).toBeUndefined();
    expect(distanceBetweenCells(view, 0, 2)).toBeUndefined();
  });

  it('counts the populations and filters the effects by kind', () => {
    expect(foodCount(view)).toBe(1);
    expect(fragmentCount(view)).toBe(1);
    expect(effectsOfKind(view, EFFECT_KIND.worldLevelUp)).toHaveLength(1);
    expect(effectsOfKind(view, EFFECT_KIND.eat)).toEqual([]);
  });

  it('reads a wild seat, its cell while it has one, and every wild cell', () => {
    const seated = { ...createWildSeatRecord(0), cellId: entityId('w-0'), targetX: 7, targetY: 8 };
    const vacant = { ...createWildSeatRecord(1), targetX: null, targetY: null };
    const wildView = viewOf({
      cells: [
        createTestCellView({ id: entityId('c-1'), playerId: alice }),
        createTestCellView({ id: entityId('w-0'), kind: CELL_KIND.wild, playerId: null }),
      ],
      wildSeats: [seated, vacant],
    });
    expect(wildSeatOf(wildView, 0)).toBe(seated);
    expect(wildSeatOf(wildView, 2)).toBeUndefined();
    expect(wildCellOf(wildView, 0)?.id).toBe('w-0');
    expect(wildCellOf(wildView, 1)).toBeUndefined();
    expect(wildCellOf(wildView, 2)).toBeUndefined();
    expect(wildCellsOf(wildView).map((cell) => cell.id)).toEqual(['w-0']);
    expect(wildCellsOf(view)).toEqual([]);
  });
});
