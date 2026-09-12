// The #259 seam: until the payout lands, a completed engulf only ends. Pinned so the seam cannot
// quietly grow a rule of its own (a cooldown, a mass transfer) outside ticket #259.

import { describe, expect, it } from 'vitest';
import { playerId } from '@evolution/shared';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import type { CellRecord } from '../world/entities.js';
import { beginEngulf, sealEngulf } from './engulf-state.js';
import { payOutEngulf } from './engulf-payout.js';

describe('payOutEngulf (the #259 seam)', () => {
  it('ends the engulf and transfers nothing: no mass, no DNA, no death, no effect', () => {
    const world = createTestWorld({
      players: [
        { playerId: playerId('a'), playerName: 'A', avatarIndex: 0 },
        { playerId: playerId('b'), playerName: 'B', avatarIndex: 1 },
      ],
    });
    const context = createTestStepContext(world);
    const [predator, prey] = world.cells as [CellRecord, CellRecord];
    beginEngulf({ predator, prey });
    sealEngulf({ predator, prey });
    const predatorMass = predator.mass;
    const cellCount = world.cells.length;
    const effectCount = world.effects.length;

    payOutEngulf(world, context, { predator, prey });

    expect(predator.engulfingCellId).toBeNull();
    expect(prey.states).toEqual([]);
    expect(prey.carriedOffsetX).toBeNull();
    expect(predator.mass).toBe(predatorMass);
    expect(world.cells).toHaveLength(cellCount);
    expect(world.effects).toHaveLength(effectCount);
  });
});
