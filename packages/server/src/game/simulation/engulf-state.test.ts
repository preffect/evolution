// docs/ECOLOGY.md §6.2: the engulf record itself, away from the step that drives it. `free` is the
// absence of both engulf states, so every path out has to leave `states` empty.

import { describe, expect, it } from 'vitest';
import { CELL_STATE, EFFECT_KIND, ENGULF_RELEASE_REASON, playerId } from '@evolution/shared';
import { createTestWorld } from '../../testing/world-builders.js';
import type { CellRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';
import {
  beginEngulf,
  clearEngulfRecords,
  engulfingPredatorOf,
  isCarried,
  releaseEngulf,
  sealEngulf,
} from './engulf-state.js';

const CARRY_OFFSET_WU = 10;
const HALF_PROGRESS = 0.5;

function twoCells(): { world: WorldState; predator: CellRecord; prey: CellRecord } {
  const world = createTestWorld({
    players: [
      { playerId: playerId('a'), playerName: 'A', avatarIndex: 0 },
      { playerId: playerId('b'), playerName: 'B', avatarIndex: 1 },
    ],
  });
  const [predator, prey] = world.cells as [CellRecord, CellRecord];
  prey.x = predator.x + CARRY_OFFSET_WU;
  prey.y = predator.y;
  return { world, predator, prey };
}

describe('beginEngulf', () => {
  it('sets both sides once, and a second call adds no duplicate state', () => {
    const { predator, prey } = twoCells();
    beginEngulf({ predator, prey });
    beginEngulf({ predator, prey });
    expect(predator.states).toEqual([CELL_STATE.engulfing]);
    expect(prey.states).toEqual([CELL_STATE.beingEngulfed]);
    expect(prey.engulfProgress).toBe(0);
  });

  it('lets one cell be predator and prey at once: a chain (docs/ECOLOGY.md §6.2)', () => {
    const { predator, prey } = twoCells();
    beginEngulf({ predator, prey });
    beginEngulf({ predator: prey, prey: predator });
    expect(prey.states).toEqual([CELL_STATE.beingEngulfed, CELL_STATE.engulfing]);
  });
});

describe('sealEngulf', () => {
  it('freezes the offset and stops the prey', () => {
    const { predator, prey } = twoCells();
    prey.velocityX = 50;
    sealEngulf({ predator, prey });
    expect(prey.carriedOffsetX).toBe(CARRY_OFFSET_WU);
    expect(prey.carriedOffsetY).toBe(0);
    expect(prey.velocityX).toBe(0);
    expect(isCarried(prey)).toBe(true);
  });
});

describe('releaseEngulf', () => {
  it('frees both sides, keeps the prey where it is and emits one cell_released', () => {
    const { world, predator, prey } = twoCells();
    beginEngulf({ predator, prey });
    prey.engulfProgress = HALF_PROGRESS;
    sealEngulf({ predator, prey });
    const effects = [...world.effects];
    releaseEngulf(world, { predator, prey }, ENGULF_RELEASE_REASON.ratio);
    expect(predator.states).toEqual([]);
    expect(prey.states).toEqual([]);
    expect(prey.engulfProgress).toBe(0);
    expect(isCarried(prey)).toBe(false);
    expect(prey.x).toBe(predator.x + CARRY_OFFSET_WU);
    expect(prey.lastRelease).toEqual({
      reason: ENGULF_RELEASE_REASON.ratio,
      tick: world.tick,
      predatorCellId: predator.id,
    });
    expect(world.effects.slice(effects.length)).toEqual([
      {
        kind: EFFECT_KIND.cellReleased,
        tick: world.tick,
        x: prey.x,
        y: prey.y,
        cellId: prey.id,
        predatorCellId: predator.id,
        reason: ENGULF_RELEASE_REASON.ratio,
      },
    ]);
  });

  it('clears the same record as the payout seam, which emits nothing', () => {
    const { world, predator, prey } = twoCells();
    beginEngulf({ predator, prey });
    const effects = world.effects.length;
    clearEngulfRecords({ predator, prey });
    expect(predator.states).toEqual([]);
    expect(prey.engulfedByCellId).toBeNull();
    expect(world.effects).toHaveLength(effects);
  });
});

describe('engulfingPredatorOf', () => {
  it('finds the predator of a held prey and nothing for a free one', () => {
    const { world, predator, prey } = twoCells();
    expect(engulfingPredatorOf(world, prey)).toBeUndefined();
    beginEngulf({ predator, prey });
    expect(engulfingPredatorOf(world, prey)).toBe(predator);
  });
});
