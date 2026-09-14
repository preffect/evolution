// The strategy seam, re-exported from its production home (`game/bots/bot-strategy.ts`) so a
// scenario keeps importing it from the framework (docs/testing/scenario-runner.md §8).
export {
  createScriptedStrategy,
  strategyScript,
  type BotStrategy,
  type BotStrategyFactory,
} from '../../game/bots/bot-strategy.js';
