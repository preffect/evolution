// The bot that never acts: a warm body in the roster (a 4-cell dish for a screenshot, a
// late-join target). Same shape as every other strategy so the CLI can name it.

import { createScriptedStrategy, type BotStrategyFactory } from '../bots.js';
import { idle } from '../scripts.js';
import { BOT_STRATEGY_NAME } from './strategy-constants.js';

export function createIdleStrategy(): BotStrategyFactory<unknown> {
  return createScriptedStrategy(BOT_STRATEGY_NAME.idle, idle);
}
