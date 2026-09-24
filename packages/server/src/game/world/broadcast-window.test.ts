import { describe, expect, it } from 'vitest';
import { EFFECT_KIND, MASS_WINDOW_AMOUNT } from '@evolution/shared';
import { createTestWorld } from '../../testing/world-builders.js';
import { drainBroadcastWindow } from './broadcast-window.js';
import { recordWindowAmount } from './mass-flow-ledger.js';

describe('drainBroadcastWindow', () => {
  it('takes the effects, keeps the world’s array, and seals the mass window with them', () => {
    const world = createTestWorld();
    const player = world.players[0]!;
    const queue = world.effects;
    const sprintSpent = 2;
    world.effects.push({ kind: EFFECT_KIND.worldLevelUp, tick: 1, level: 2, stage: 'prokaryote' });
    recordWindowAmount(world.massFlow, player.playerId, MASS_WINDOW_AMOUNT.sprintSpent, sprintSpent);
    expect(drainBroadcastWindow(world)).toHaveLength(1);
    expect(world.effects).toBe(queue);
    expect(world.effects).toEqual([]);
    expect(world.massFlow.sealedWindowByPlayer[player.playerId]?.sprintSpent).toBe(sprintSpent);
    expect(drainBroadcastWindow(world)).toEqual([]);
    expect(world.massFlow.sealedWindowByPlayer[player.playerId]).toBeUndefined();
  });
});
