// The build-1 bot strategies (docs/TESTING.md §8.3), re-exported from their production home
// (`game/bots/`) plus the scenario-only script sequence: what a scenario file imports.
export {
  createScriptedStrategy,
  idle,
  strategyScript,
  type BotStrategy,
  type BotStrategyFactory,
  type PlayerCommand,
  type PlayerScript,
  type ScriptContext,
  type TraitChoiceCommand,
} from '../../../game/bots/bot-strategy.js';
export {
  NO_WORLD_PERCEPTION,
  nearestTo,
  type BotCellView,
  type BotMoteView,
  type BotPerception,
  type CellLocation,
  type EngulfPredatorView,
  type EngulfPreyView,
} from '../../../game/bots/perception.js';
export { createGrazerStrategy } from '../../../game/bots/strategies/grazer.js';
export { createHunterStrategy, type HunterOptions } from '../../../game/bots/strategies/hunter.js';
export { createIdleStrategy } from '../../../game/bots/strategies/idle.js';
export { createWanderStrategy, type WanderOptions } from '../../../game/bots/strategies/wander.js';
export { createStrategyByName, type CatalogOptions } from '../../../game/bots/strategy-catalog.js';
export {
  BOT_STRATEGY_NAME,
  BOT_STRATEGY_NAMES,
  HUNTER_SPRINT_WITHIN_RADII,
  WANDER_STEP_WU,
  WANDER_TURN_SIGMA_RADIANS,
  isBotStrategyName,
  type BotStrategyName,
} from '../../../game/bots/strategy-constants.js';
export {
  SCRIPT_SEQUENCE_STRATEGY_NAME,
  createScriptSequenceStrategy,
  type ScriptSequenceOptions,
  type ScriptSequenceStep,
} from './script-sequence.js';
