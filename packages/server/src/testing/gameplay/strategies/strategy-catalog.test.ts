import { describe, expect, it } from 'vitest';
import { playerId } from '@evolution/shared';
import {
  TEST_PLAYER_ID,
  createTestBotCell,
  createTestPerception,
  createTestScriptContext,
  createTestWorldView,
} from '../../bot-builders.js';
import { UnknownBotStrategyError, createStrategyByName } from './strategy-catalog.js';
import { BOT_STRATEGY_NAMES, isBotStrategyName } from './strategy-constants.js';

const perception = createTestPerception();

describe('strategy catalog', () => {
  it('builds every named strategy under its own name', () => {
    for (const name of BOT_STRATEGY_NAMES) {
      expect(createStrategyByName(name, perception)().name).toBe(name);
    }
  });

  it('rejects a name that is not in the catalog', () => {
    expect(() => createStrategyByName('flee', perception)).toThrow(UnknownBotStrategyError);
    expect(() => createStrategyByName('flee', perception)).toThrow(/idle, wander, grazer, hunter/);
    expect(isBotStrategyName('grazer')).toBe(true);
    expect(isBotStrategyName('flee')).toBe(false);
  });

  it('hands the hunter its prey option', () => {
    const self = createTestBotCell({ id: 'self', playerId: TEST_PLAYER_ID, mass: 100 });
    const prey = createTestBotCell({ id: 'prey', playerId: playerId('player_1'), x: 50, y: 0, mass: 10 });
    const other = createTestBotCell({ id: 'other', playerId: playerId('player_2'), x: 0, y: 50, mass: 60 });
    const strategy = createStrategyByName('hunter', perception, { preyPlayerId: prey.playerId })();
    const context = createTestScriptContext({
      snapshot: createTestWorldView({ cells: [self, prey, other] }),
      cell: { x: 0, y: 0, radiusWu: 10 },
    });
    expect(strategy.decide(context)).toEqual({ targetX: 50, targetY: 0 });
  });
});
