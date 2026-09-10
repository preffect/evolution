// The numbers the build-1 strategies walk and hunt by (docs/TESTING.md §8.4). They tune test
// opponents, not the game, so they live with the strategies rather than in `constants/`.

/** How far ahead of its centre a wandering bot aims each decision, in world units. */
export const WANDER_STEP_WU = 40;
/** Standard deviation of the heading change per decision, in radians (a gentle drift, not a jitter). */
export const WANDER_TURN_SIGMA_RADIANS = 0.6;
/** A hunter sprints once its prey is within this many of its own radii. */
export const HUNTER_SPRINT_WITHIN_RADII = 4;
/** The names the CLI and `debug_spawn_bot` accept (`strategy-catalog.ts`). */
export const BOT_STRATEGY_NAME = {
  idle: 'idle',
  wander: 'wander',
  grazer: 'grazer',
  hunter: 'hunter',
} as const;

export type BotStrategyName = (typeof BOT_STRATEGY_NAME)[keyof typeof BOT_STRATEGY_NAME];

export const BOT_STRATEGY_NAMES: readonly BotStrategyName[] = [
  BOT_STRATEGY_NAME.idle,
  BOT_STRATEGY_NAME.wander,
  BOT_STRATEGY_NAME.grazer,
  BOT_STRATEGY_NAME.hunter,
];

export function isBotStrategyName(value: string): value is BotStrategyName {
  return (BOT_STRATEGY_NAMES as readonly string[]).includes(value);
}
