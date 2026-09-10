// Test builders for the wire contract (docs/TESTING.md §4): every server and client test that
// needs a session config, an input or a snapshot builds it here, so a shape change is one edit.
// Builder defaults are the only tolerated inline test numbers. The simulation builders
// (`createTestCell`, `createTestWorld`) join this file with #98.

import { CELL_STAGE, GAME_MODE, ROUND_END_CONDITION, ROUND_PHASE } from '../types/game.js';
import type { CellView } from '../types/game.js';
import { entityId, playerId } from '../types/common.js';
import type { ClientPerformanceReport, GameInput, GameSessionConfig, GameSnapshot } from '../types/messages.js';
import { RENDER_STAGE_NAMES } from '../types/messages.js';
import { DEFAULT_PLAYERS_PER_GAME } from '../constants/lobby.js';
import { ROUND_DURATION_SECONDS } from '../constants/session.js';
import { MILLISECONDS_PER_SECOND } from '../constants/units.js';

const TEST_SEED = 42;

export function createTestSessionConfig(overrides: Partial<GameSessionConfig> = {}): GameSessionConfig {
  return {
    maxPlayers: DEFAULT_PLAYERS_PER_GAME,
    seed: TEST_SEED,
    mode: GAME_MODE.freeForAll,
    roundDurationSeconds: ROUND_DURATION_SECONDS,
    endCondition: ROUND_END_CONDITION.timer,
    ...overrides,
  };
}

export function createTestGameInput(overrides: Partial<GameInput> = {}): GameInput {
  return { sequence: 1, targetX: 0, targetY: 0, shouldSprint: false, traitChoice: null, ...overrides };
}

/** An empty world at tick 0 of a default-length round; pass the fields the test reads. */
export function createTestSnapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    tick: 0,
    seed: TEST_SEED,
    roundPhase: ROUND_PHASE.playing,
    roundTimeLeftMs: ROUND_DURATION_SECONDS * MILLISECONDS_PER_SECOND,
    gelPatches: [],
    cells: [],
    dnaFragments: [],
    food: { spawned: [], removedIds: [], moved: [] },
    players: {},
    leaderboard: [],
    appliedInputSequenceByPlayer: {},
    effects: [],
    ...overrides,
  };
}

/** A healthy 60 fps report with every render stage present; pass the fields the test reads. */
export function createTestPerformanceReport(overrides: Partial<ClientPerformanceReport> = {}): ClientPerformanceReport {
  const renderStagesMs = Object.fromEntries(RENDER_STAGE_NAMES.map((stage) => [stage, 0.5]));
  return {
    fps: 60,
    frameTimeAvgMs: 16,
    frameTimeP95Ms: 20,
    frameTimePeakMs: 30,
    heapMb: null,
    renderStagesMs: renderStagesMs as ClientPerformanceReport['renderStagesMs'],
    gpuMs: null,
    drawCalls: 12,
    visibleCells: 8,
    visibleMotes: 1400,
    ...overrides,
  };
}

/** A resting prokaryote view at the starting size; pass the fields the test reads. */
export function createTestCellView(overrides: Partial<CellView> = {}): CellView {
  const id = overrides.id ?? entityId('c-1');
  return {
    id,
    playerId: playerId('p1'),
    organismId: id,
    avatarIndex: 0,
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    mass: 20,
    radius: 17.9,
    level: 1,
    stage: CELL_STAGE.prokaryote,
    traits: [{ traitId: 'nucleoid', tier: 1 }],
    membraneRatioBonus: 0,
    states: ['free'],
    engulfProgress: 0,
    engulfingCellId: null,
    engulfedByCellId: null,
    sprintRemainingTicks: 0,
    sprintCooldownRemainingTicks: 0,
    ...overrides,
  };
}
