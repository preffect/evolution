// Name → factory, for the two callers that name a strategy as a string: the bot client CLI
// (`--strategy grazer`) and `debug_spawn_bot(gameId, behavior)`. Perception-free strategies
// ignore the perception; the script sequence has no name because it needs code, not a string.

import type { PlayerId } from '@evolution/shared';
import type { BotStrategyFactory } from '../bots.js';
import { createGrazerStrategy } from './grazer.js';
import { createHunterStrategy } from './hunter.js';
import { createIdleStrategy } from './idle.js';
import type { BotPerception } from './perception.js';
import {
  BOT_STRATEGY_NAME,
  BOT_STRATEGY_NAMES,
  isBotStrategyName,
  type BotStrategyName,
} from './strategy-constants.js';
import { createWanderStrategy } from './wander.js';

export interface CatalogOptions {
  /** `hunter` only: hunt this player alone. */
  readonly preyPlayerId?: PlayerId;
}

export class UnknownBotStrategyError extends Error {
  constructor(name: string) {
    super(`unknown bot strategy "${name}"; expected one of ${BOT_STRATEGY_NAMES.join(', ')}`);
    this.name = 'UnknownBotStrategyError';
  }
}

export function createStrategyByName<Snapshot>(
  name: string,
  perception: BotPerception<Snapshot>,
  options: CatalogOptions = {},
): BotStrategyFactory<Snapshot> {
  if (!isBotStrategyName(name)) {
    throw new UnknownBotStrategyError(name);
  }
  const factories: Record<BotStrategyName, () => BotStrategyFactory<Snapshot>> = {
    [BOT_STRATEGY_NAME.idle]: () => createIdleStrategy(),
    [BOT_STRATEGY_NAME.wander]: () => createWanderStrategy(),
    [BOT_STRATEGY_NAME.grazer]: () => createGrazerStrategy(perception),
    [BOT_STRATEGY_NAME.hunter]: () => createHunterStrategy(perception, options),
  };
  return factories[name]();
}
