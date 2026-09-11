import { describe, expect, it } from 'vitest';
import { createSeededRandom, playerId } from '@evolution/shared';
import { createScriptedStrategy, idle, strategyScript, type ScriptContext } from './bot-strategy.js';

const SEED = 42;
const CONTEXT: ScriptContext<null> = {
  tick: 0,
  stepTick: 1,
  playerIndex: 0,
  playerId: playerId('player_0'),
  snapshot: null,
  cell: undefined,
  seed: SEED,
  random: createSeededRandom(SEED),
};

describe('bot strategies', () => {
  it('wraps a script as a named strategy factory and back into a script', () => {
    const createStrategy = createScriptedStrategy('east', () => ({ targetX: 1, targetY: 0 }));
    const strategy = createStrategy();
    expect(strategy.name).toBe('east');
    expect(strategy.decide(CONTEXT)).toEqual({ targetX: 1, targetY: 0 });
    expect(strategyScript(strategy)(CONTEXT)).toEqual({ targetX: 1, targetY: 0 });
  });

  it('builds a fresh instance on every call, so each run starts from a clean strategy', () => {
    const createStrategy = createScriptedStrategy('idle', () => null);
    expect(createStrategy()).not.toBe(createStrategy());
  });

  it('lets a strategy decline to act', () => {
    expect(strategyScript(createScriptedStrategy('idle', () => null)())(CONTEXT)).toBeNull();
    expect(idle(CONTEXT)).toBeNull();
  });
});
