// The numbers the build-1 strategies walk, hunt and flee by (docs/testing/bots-and-design-tables.md §8.3). They tune bot
// opponents, not the game, so they live with the strategies rather than in `constants/`; a
// caller with other numbers passes them through `WanderOptions` / `HunterOptions` / `FleeOptions`.
// The wild cells' numbers come from `constants/wild-cells.ts` and travel through those same
// options (`game/wild/wild-strategy.ts`); the defaults here stay the bot-client defaults.

/** How far ahead of its centre a wandering bot aims each decision, in world units. */
export const WANDER_STEP_WU = 40;
/** Standard deviation of the heading change per decision, in radians (a gentle drift, not a jitter). */
export const WANDER_TURN_SIGMA_RADIANS = 0.6;
/** A hunter sprints once its prey is within this many of its own radii. */
export const HUNTER_SPRINT_WITHIN_RADII = 4;
/** A fleeing bot reacts to a threat within this many of its own radii. */
export const FLEE_WITHIN_RADII = 8;
/** How far past its own centre a fleeing bot aims, in own radii (the full-throttle distance of the steer kernel). */
export const FLEE_STEP_RADII = 2;
/** Which candidate a hunter takes when it holds no commitment. */
export const HUNT_PREFERENCE = {
  largest: 'largest',
  nearest: 'nearest',
} as const;

export type HuntPreference = (typeof HUNT_PREFERENCE)[keyof typeof HUNT_PREFERENCE];

/** The names the CLI and `debug_spawn_bot` accept (`strategy-catalog.ts`). */
export const BOT_STRATEGY_NAME = {
  idle: 'idle',
  wander: 'wander',
  grazer: 'grazer',
  hunter: 'hunter',
  flee: 'flee',
} as const;

export type BotStrategyName = (typeof BOT_STRATEGY_NAME)[keyof typeof BOT_STRATEGY_NAME];

/** The catalogue as a tuple, so the MCP schema can be `z.enum(BOT_STRATEGY_NAMES)` and a wrong name is told the list. */
export const BOT_STRATEGY_NAMES = [
  BOT_STRATEGY_NAME.idle,
  BOT_STRATEGY_NAME.wander,
  BOT_STRATEGY_NAME.grazer,
  BOT_STRATEGY_NAME.hunter,
  BOT_STRATEGY_NAME.flee,
] as const satisfies readonly BotStrategyName[];

export function isBotStrategyName(value: string): value is BotStrategyName {
  return (BOT_STRATEGY_NAMES as readonly string[]).includes(value);
}
