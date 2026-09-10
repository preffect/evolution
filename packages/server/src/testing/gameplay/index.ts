// The gameplay testing framework (docs/TESTING.md §8): what a scenario file imports.
export type {
  CellLocation,
  FixtureContext,
  PlayerCommand,
  ScenarioAdapter,
  ScenarioModuleOptions,
  TraitChoiceCommand,
} from './adapter.js';
export { createScriptedStrategy, strategyScript, type BotStrategy, type BotStrategyFactory } from './bots.js';
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
export { CaptureBuilder, ExpectationBuilder, MatcherBuilder } from './expectation-builder.js';
export { AT_END, type Capture, type Expectation, type ScenarioView, type Selector } from './expectations.js';
export {
  FIRST_TRAIT_TIER,
  GEL_PATCH_CLEARANCE_WU,
  LAST_TRAIT_TIER,
  PLACED_KIND,
  createDecayedHelper,
  isClearOfGelPatches,
  type DecayConstants,
  type PlaceCellOptions,
  type PlaceFragmentOptions,
  type PlaceMoteOptions,
  type PlacedCell,
  type PlacedFixture,
  type PlacedFragment,
  type PlacedMote,
  type PlacedTrait,
  type PlacedTraitOption,
} from './fixtures.js';
export type { Matcher, MatchOutcome } from './matchers.js';
export {
  ANCHOR_KIND,
  BROTH_POINT,
  VENT_POINT,
  ZONE,
  atPoint,
  describeAnchor,
  eastOfCellOf,
  gelPatchCentre,
  insideCellOf,
  resolveFixedAnchor,
  shallowsPoint,
  toAnchor,
  type DishDimensions,
  type PlacementAnchor,
} from './placement.js';
export { FixtureScheduler } from './placement-builder.js';
export {
  MEMBERSHIP_EVENT_KIND,
  SCENARIO_REPLAY_FORMAT_VERSION,
  indexByTick,
  type ReplayCheckpoint,
  type ReplayFixturePatch,
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
export {
  runScenario,
  type RunOptions,
  type ScenarioDefinition,
  type ScenarioRun,
  type ScenarioRunner,
  type ScheduledFixture,
} from './runner.js';
export { player, scenarioPlayerId, type PlayerHandle, type PlayerScriptEntry } from './players.js';
export { DEFAULT_HASH_EVERY_TICKS, ScenarioBuilder, createScenarioDsl, type ScenarioDsl } from './scenario.js';
export type { ScheduledScript, ScheduleWindow } from './schedule.js';
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
export { isPlayerPresentAt, type ScenarioPlayer } from './session.js';
