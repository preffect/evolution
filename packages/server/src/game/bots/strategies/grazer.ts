// The grazer aims at the nearest mote every decision. It reads nothing but the perception and
// its own cell, draws no randomness, and sends nothing while it has no cell or sees no food.

import type { BotStrategy, BotStrategyFactory } from '../bot-strategy.js';
import { nearestTo, type BotPerception } from '../perception.js';
import { BOT_STRATEGY_NAME } from '../strategy-constants.js';

export function createGrazerStrategy<Snapshot>(perception: BotPerception<Snapshot>): BotStrategyFactory<Snapshot> {
  return (): BotStrategy<Snapshot> => ({
    name: BOT_STRATEGY_NAME.grazer,
    decide(context) {
      const cell = context.cell;
      if (cell === undefined) {
        return null;
      }
      const mote = nearestTo(cell, perception.motesOf(context.snapshot));
      return mote === undefined ? null : { targetX: mote.x, targetY: mote.y };
    },
  });
}
