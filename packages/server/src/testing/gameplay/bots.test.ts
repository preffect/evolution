import { describe, expect, it } from 'vitest';
import { playerId } from '@evolution/shared';
import { createScriptedStrategy, strategyScript } from './bots.js';
import type { ScriptContext } from './scripts.js';

const CONTEXT: ScriptContext<null> = {
  tick: 0,
  stepTick: 1,
  playerIndex: 0,
  playerId: playerId('player_0'),
  snapshot: null,
  cell: undefined,
};

describe('bot strategies', () => {
  it('wraps a script as a named strategy and back into a script', () => {
    const strategy = createScriptedStrategy('east', () => ({ targetX: 1, targetY: 0 }));
    expect(strategy.name).toBe('east');
    expect(strategy.decide(CONTEXT)).toEqual({ targetX: 1, targetY: 0 });
    expect(strategyScript(strategy)(CONTEXT)).toEqual({ targetX: 1, targetY: 0 });
  });

  it('lets a strategy decline to act', () => {
    expect(strategyScript(createScriptedStrategy('idle', () => null))(CONTEXT)).toBeNull();
  });
});
