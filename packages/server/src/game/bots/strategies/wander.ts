// A seeded random walk: the heading drifts by a gaussian turn each decision and the bot aims
// one step ahead along it. With a cell the step is taken from the cell's current centre, so the
// walk never runs away from where the cell actually is; without one (the echo module, a bot
// that has not spawned yet) it advances its own remembered point, so the inputs still change.
// Every draw comes from `context.random`: two bots with the same stream walk the same path.

import type { BotStrategy, BotStrategyFactory, PlayerCommand, ScriptContext } from '../bot-strategy.js';
import { BOT_STRATEGY_NAME, WANDER_STEP_WU, WANDER_TURN_SIGMA_RADIANS } from '../strategy-constants.js';

export interface WanderOptions {
  readonly stepWu?: number;
  readonly turnSigmaRadians?: number;
  /** Where the walk starts when the bot has no cell to anchor on. */
  readonly origin?: { readonly x: number; readonly y: number };
}

const DEFAULT_ORIGIN = { x: 0, y: 0 };

export function createWanderStrategy(options: WanderOptions = {}): BotStrategyFactory<unknown> {
  const { stepWu = WANDER_STEP_WU, turnSigmaRadians = WANDER_TURN_SIGMA_RADIANS, origin = DEFAULT_ORIGIN } = options;
  return (): BotStrategy<unknown> => {
    let heading = 0;
    let point = { ...origin };
    return {
      name: BOT_STRATEGY_NAME.wander,
      decide(context: ScriptContext<unknown>): PlayerCommand {
        heading += context.random.nextGaussian() * turnSigmaRadians;
        const anchor = context.cell ?? point;
        point = { x: anchor.x + Math.cos(heading) * stepWu, y: anchor.y + Math.sin(heading) * stepWu };
        return { targetX: point.x, targetY: point.y };
      },
    };
  };
}
