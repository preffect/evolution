import { describe, expect, it } from 'vitest';
import { playerId } from '@evolution/shared';
import {
  TEST_PLAYER_ID,
  createTestBotCell,
  createTestPerception,
  createTestScriptContext,
  createTestWorldView,
} from '../../testing/bot-builders.js';
import { createStrategyByName } from './strategy-catalog.js';
import { BOT_STRATEGY_NAMES, isBotStrategyName } from './strategy-constants.js';

const perception = createTestPerception();

describe('strategy catalog', () => {
  it('builds every named strategy under its own name', () => {
    for (const name of BOT_STRATEGY_NAMES) {
      expect(createStrategyByName(name, perception)().name).toBe(name);
    }
  });

  it('tells a catalogue name from any other string, which is how the CLI and the tool schema gate the catalogue', () => {
    expect(BOT_STRATEGY_NAMES).toEqual(['idle', 'wander', 'grazer', 'hunter', 'flee', 'forager']);
    expect(isBotStrategyName('grazer')).toBe(true);
    expect(isBotStrategyName('flee')).toBe(true);
    expect(isBotStrategyName('forager')).toBe(true);
    expect(isBotStrategyName('sleep')).toBe(false);
  });

  it('hands the hunter its prey option', () => {
    const self = createTestBotCell({ id: 'self', playerId: TEST_PLAYER_ID, mass: 100 });
    const prey = createTestBotCell({ id: 'prey', playerId: playerId('player_1'), x: 50, y: 0, mass: 10 });
    const other = createTestBotCell({ id: 'other', playerId: playerId('player_2'), x: 0, y: 50, mass: 60 });
    const strategy = createStrategyByName('hunter', perception, { preyPlayerId: prey.playerId })();
    const context = createTestScriptContext({
      snapshot: createTestWorldView({ cells: [self, prey, other] }),
      cell: { x: 0, y: 0, radius: 10 },
    });
    expect(strategy.decide(context)).toEqual({ targetX: 50, targetY: 0 });
  });

  it('registers the hunter that grazes while it has no prey and the forager that grazes until a threat comes close', () => {
    const self = createTestBotCell({ id: 'self', playerId: TEST_PLAYER_ID, mass: 20 });
    const threat = createTestBotCell({ id: 'threat', playerId: playerId('player_1'), x: 30, y: 0, mass: 100 });
    const mote = { id: 'mote', x: 0, y: 5 };
    const context = createTestScriptContext({
      snapshot: createTestWorldView({ cells: [self, threat], motes: [mote] }),
      cell: { x: 0, y: 0, radius: 10 },
    });
    expect(createStrategyByName('hunter', perception)().decide(context)).toEqual({ targetX: 0, targetY: 5 });
    expect(createStrategyByName('forager', perception)().decide(context)).toMatchObject({ targetX: -20, targetY: 0 });
  });
});
