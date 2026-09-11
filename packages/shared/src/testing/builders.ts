// Test builders for the wire contract (docs/TESTING.md §4): every server and client test that
// needs a session config, an input or a snapshot builds it here, so a shape change is one edit.
// Builder defaults are the only tolerated inline test numbers. The simulation builders
// (`createTestCell`, `createTestWorld`) join this file with #98.

import { GAME_MODE, ROUND_END_CONDITION, ROUND_PHASE } from '../types/game.js';
import type { GameInput, GameSessionConfig, GameSnapshot } from '../types/messages.js';
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
