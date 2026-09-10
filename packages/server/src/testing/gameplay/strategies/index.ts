// The build-1 bot strategies (docs/TESTING.md §8.4): what a scenario, the bot client and the
// echo module's in-process bots import.
export { createGrazerStrategy } from './grazer.js';
export { createHunterStrategy, type HunterOptions } from './hunter.js';
export { createIdleStrategy } from './idle.js';
export {
  NO_WORLD_PERCEPTION,
  distanceBetween,
  nearestTo,
  type BotCellView,
  type BotMoteView,
  type BotPerception,
  type EngulfPredatorView,
  type EngulfPreyView,
} from './perception.js';
export {
  SCRIPT_SEQUENCE_STRATEGY_NAME,
  createScriptSequenceStrategy,
  type ScriptSequenceOptions,
  type ScriptSequenceStep,
} from './script-sequence.js';
export { UnknownBotStrategyError, createStrategyByName, type CatalogOptions } from './strategy-catalog.js';
export {
  BOT_STRATEGY_NAME,
  BOT_STRATEGY_NAMES,
  HUNTER_SPRINT_WITHIN_RADII,
  WANDER_STEP_WU,
  WANDER_TURN_SIGMA_RADIANS,
  isBotStrategyName,
  type BotStrategyName,
} from './strategy-constants.js';
export { createWanderStrategy, type WanderOptions } from './wander.js';
