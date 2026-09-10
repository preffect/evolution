// Name → factory, for the two callers that name a strategy as a string: the bot client CLI
// (`--strategy grazer`) and `debug_spawn_bot(gameId, behavior)`. Both validate the string at
// their edge (`isBotStrategyName` in the CLI parser, `z.enum(BOT_STRATEGY_NAMES)` in the tool
// schema), so the catalogue takes a `BotStrategyName` and never sees an unknown one.
// Perception-free strategies ignore the perception; the script sequence
// (`testing/gameplay/strategies/script-sequence.ts`) has no name because it needs code, not a string.

import type { PlayerId } from '@evolution/shared';
import type { BotStrategyFactory } from './bot-strategy.js';
import type { BotPerception } from './perception.js';
import { createGrazerStrategy } from './strategies/grazer.js';
import { createHunterStrategy } from './strategies/hunter.js';
import { createIdleStrategy } from './strategies/idle.js';
import { createWanderStrategy } from './strategies/wander.js';
import { BOT_STRATEGY_NAME, type BotStrategyName } from './strategy-constants.js';

export interface CatalogOptions {
  /** `hunter` only: hunt this player alone. */
  readonly preyPlayerId?: PlayerId;
}

export function createStrategyByName<Snapshot>(
  name: BotStrategyName,
  perception: BotPerception<Snapshot>,
  options: CatalogOptions = {},
): BotStrategyFactory<Snapshot> {
  const factories: Record<BotStrategyName, () => BotStrategyFactory<Snapshot>> = {
    [BOT_STRATEGY_NAME.idle]: () => createIdleStrategy(),
    [BOT_STRATEGY_NAME.wander]: () => createWanderStrategy(),
    [BOT_STRATEGY_NAME.grazer]: () => createGrazerStrategy(perception),
    [BOT_STRATEGY_NAME.hunter]: () => createHunterStrategy(perception, options),
  };
  return factories[name]();
}
