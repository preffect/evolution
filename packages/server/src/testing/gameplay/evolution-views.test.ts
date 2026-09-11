import { describe, expect, it } from 'vitest';
import {
  EFFECT_KIND,
  createTestCellView,
  createTestPlayerProgressView,
  createTestSnapshot,
  entityId,
  playerId,
} from '@evolution/shared';
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
  type EvolutionView,
} from './evolution-views.js';

const alice = playerId('player_0');
const bob = playerId('player_1');

function viewOf(snapshot: Partial<EvolutionScenarioSnapshot>): EvolutionView {
  return {
    tick: 5,
    seed: 42,
    snapshot: { ...createTestSnapshot(), spawnedCounts: { food: 0, dnaFragments: 0 }, ...snapshot },
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
    players: { [alice]: createTestPlayerProgressView({ playerId: alice, level: 3 }) },
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
});
