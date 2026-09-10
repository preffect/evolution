// The bot that never acts: a warm body in the roster (a 4-cell dish for a screenshot, a
// late-join target). Same shape as every other strategy so the CLI can name it.

import { createScriptedStrategy, idle, type BotStrategyFactory } from '../bot-strategy.js';
import { BOT_STRATEGY_NAME } from '../strategy-constants.js';

export function createIdleStrategy(): BotStrategyFactory<unknown> {
  return createScriptedStrategy(BOT_STRATEGY_NAME.idle, idle);
}
