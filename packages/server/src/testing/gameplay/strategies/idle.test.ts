import { describe, expect, it } from 'vitest';
import { createTestScriptContext } from '../../builders.js';
import { createIdleStrategy } from './idle.js';
import { BOT_STRATEGY_NAME } from './strategy-constants.js';

describe('idle strategy', () => {
  it('is named idle and never sends an input', () => {
    const strategy = createIdleStrategy()();
    expect(strategy.name).toBe(BOT_STRATEGY_NAME.idle);
    expect(strategy.decide(createTestScriptContext())).toBeNull();
    expect(strategy.decide(createTestScriptContext({ tick: 5, stepTick: 6 }))).toBeNull();
  });
});
