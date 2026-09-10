// The gameplay testing framework (docs/TESTING.md §8): what a scenario file imports.
export type {
  CellLocation,
  PlayerCommand,
  ScenarioAdapter,
  ScenarioModuleOptions,
  TraitChoiceCommand,
} from './adapter.js';
export { createScriptedStrategy, strategyScript, type BotStrategy } from './bots.js';
export {
  echoAdapter,
  echoedInput,
  echoScenario,
  hashEchoSnapshot,
  type EchoInput,
  type EchoSnapshot,
} from './echo-adapter.js';
export {
  ScenarioAssertionError,
  ScenarioDivergenceError,
  ScenarioSetupError,
  formatDivergence,
  formatExpectationFailure,
  type ExpectationFailure,
  type HashDivergence,
} from './errors.js';
export { ExpectationBuilder, MatcherBuilder } from './expectation-builder.js';
export { AT_END, type Expectation, type ScenarioView, type Selector } from './expectations.js';
export {
  BROTH_POINT,
  GEL_PATCH_CLEARANCE_WU,
  PLACED_KIND,
  VENT_POINT,
  createDecayedHelper,
  isClearOfGelPatches,
  shallowsPoint,
  type DecayConstants,
  type PlaceCellOptions,
  type PlaceFragmentOptions,
  type PlaceMoteOptions,
  type PlacedCell,
  type PlacedFixture,
  type PlacedFragment,
  type PlacedMote,
} from './fixtures.js';
export {
  MEMBERSHIP_EVENT_KIND,
  SCENARIO_REPLAY_FORMAT_VERSION,
  type ReplayCheckpoint,
  type ReplayInput,
  type ReplayMembershipEvent,
  type ReplayPlayer,
  type ScenarioReplay,
} from './replay-format.js';
export {
  DEFAULT_REPLAY_DIRECTORY,
  createFileReplaySink,
  createMemoryReplaySink,
  replayFileName,
  type ReplaySink,
} from './replay-sink.js';
export {
  assertDeterministic,
  findFirstDivergence,
  replayScenario,
  verifyReplay,
  type ReplayVerdict,
} from './replay.js';
export { runScenario, type RunOptions, type ScenarioDefinition, type ScenarioRun } from './runner.js';
export {
  DEFAULT_HASH_EVERY_TICKS,
  ScenarioBuilder,
  createScenarioDsl,
  player,
  scenarioPlayerId,
  type PlayerScriptEntry,
  type ScenarioDsl,
} from './scenario.js';
export {
  chooseTrait,
  combineScripts,
  command,
  idle,
  mergeCommands,
  sprint,
  targetPoint,
  targetRadiiAwayFrom,
  targetRadiiEast,
  type PlayerScript,
  type ScriptContext,
} from './scripts.js';
export type { ScenarioPlayer } from './session.js';
