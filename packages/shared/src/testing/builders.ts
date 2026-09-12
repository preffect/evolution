// Test builders for the wire contract (docs/TESTING.md §4): every server and client test that
// needs a session config, an input, a snapshot or a view builds it here, so a shape change is
// one edit. Builder defaults are the only tolerated inline test numbers. The server's records
// (`createTestWorld`, `createTestPlayerRecord`) are built in the server package beside the
// records (`packages/server/src/testing/world-builders.ts`).

import {
  CELL_KIND,
  CELL_STAGE,
  GAME_MODE,
  PLAYER_LIFE_STATE,
  ROUND_END_CONDITION,
  ROUND_PHASE,
} from '../types/game.js';
import type { CellView, PlayerProgressView } from '../types/game.js';
import { RENDER_STAGE_NAMES } from '../types/messages.js';
import type { ClientPerformanceReport, GameInput, GameSessionConfig, GameSnapshot } from '../types/messages.js';
import { entityId, playerId, zeroRecord } from '../types/common.js';
import { BACTERIUM_VARIANTS } from '../constants/ecology.js';
import { DNA_TAGS } from '../constants/progression.js';
import { DEFAULT_PLAYERS_PER_GAME } from '../constants/lobby.js';
import { ROUND_DURATION_SECONDS } from '../constants/session.js';
import { MILLISECONDS_PER_SECOND } from '../constants/units.js';
import { CELL_STARTING_MASS } from '../constants/growth.js';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { radiusForMass } from '../simulation/mass-curves.js';

const TEST_SEED = 42;
const TEST_PLAYER_ID = playerId('p1');
const TEST_CELL_ID = entityId('c-1');

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

/** A free player protocell at the origin at starting mass; pass the fields the test reads. */
export function createTestCellView(overrides: Partial<CellView> = {}): CellView {
  const mass = overrides.mass ?? CELL_STARTING_MASS;
  return {
    id: TEST_CELL_ID,
    kind: CELL_KIND.player,
    playerId: TEST_PLAYER_ID,
    organismId: TEST_CELL_ID,
    avatarIndex: 0,
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    mass,
    radius: radiusForMass(mass, DEFAULT_BALANCE.growth),
    level: 1,
    stage: CELL_STAGE.protocell,
    traits: [],
    membraneRatioBonus: 0,
    states: [],
    engulfProgress: 0,
    engulfingCellId: null,
    engulfedByCellId: null,
    sprintRemainingTicks: 0,
    sprintCooldownRemainingTicks: 0,
    ...overrides,
  };
}

/** A level-1 player with nothing eaten, alive and offer-less. */
export function createTestPlayerProgressView(overrides: Partial<PlayerProgressView> = {}): PlayerProgressView {
  return {
    playerId: TEST_PLAYER_ID,
    playerName: 'Player 1',
    level: 1,
    dnaCumulative: 0,
    dnaCatchUpGift: 0,
    dnaTowardNextLevel: 0,
    dnaTagPoints: zeroRecord(DNA_TAGS),
    bacteriaEatenByVariant: zeroRecord(BACTERIUM_VARIANTS),
    absorptions: 0,
    wildAbsorptions: 0,
    score: 0,
    offer: null,
    lifeState: PLAYER_LIFE_STATE.alive,
    spectatingCellId: null,
    respawnInTicks: 0,
    ...overrides,
  };
}

/** An empty world at tick 0 of a default-length round; pass the fields the test reads. */
export function createTestSnapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    tick: 0,
    seed: TEST_SEED,
    roundStartTick: 0,
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

/** A client frame report inside every docs/RENDERING.md §7 budget; pass the fields the test reads. */
export function createTestClientPerformanceReport(
  overrides: Partial<ClientPerformanceReport> = {},
): ClientPerformanceReport {
  return {
    fps: 60,
    frameTimeAvgMs: 4,
    frameTimeP95Ms: 6,
    frameTimePeakMs: 9,
    heapMb: null,
    renderStagesMs: zeroRecord(RENDER_STAGE_NAMES),
    gpuMs: null,
    drawCalls: 9,
    visibleCells: 8,
    visibleMotes: 1400,
    ...overrides,
  };
}
