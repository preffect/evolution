// Test builders for the simulation records (docs/TESTING.md §4): a world, a step context and a
// player record with defaults, so a shape change is one edit. Builder defaults are the only
// tolerated inline test numbers.

import { DEFAULT_BALANCE, createTestSessionConfig, playerId } from '@evolution/shared';
import { createPlayerRecord, type PlayerIdentity } from '../session/players.js';
import { createWorld } from '../world/create-world.js';
import type { PlayerRecord } from '../world/entities.js';
import { resumeStreams } from '../world/streams.js';
import { createInputRejectionCounters, type StepContext, type WorldState } from '../world/world-state.js';

const TEST_SEED = 42;

export const TEST_PLAYER: PlayerIdentity = { playerId: playerId('p1'), playerName: 'Alice', avatarIndex: 0 };

export interface TestWorldOptions {
  readonly players?: readonly PlayerIdentity[];
  /** Keep the seeded motes and spawners; off by default so arithmetic is exact. */
  readonly isFilled?: boolean;
  readonly seed?: number;
}

/** A seeded world with one player; the dish is emptied and the spawners are off unless `isFilled`. */
export function createTestWorld(options: TestWorldOptions = {}): WorldState {
  const seed = options.seed ?? TEST_SEED;
  const world = createWorld({
    seed,
    config: createTestSessionConfig({ seed }),
    balance: DEFAULT_BALANCE,
    players: options.players ?? [TEST_PLAYER],
  });
  if (!options.isFilled) {
    world.food = [];
    world.dnaFragments = [];
    world.spawners.food.isEnabled = false;
    world.spawners.dnaFragments.isEnabled = false;
  }
  return world;
}

export function createTestStepContext(world: WorldState, overrides: Partial<StepContext> = {}): StepContext {
  return {
    balance: world.balance,
    streams: resumeStreams(world),
    effects: world.effects,
    rejections: createInputRejectionCounters(),
    ...overrides,
  };
}

export function createTestPlayerRecord(overrides: Partial<PlayerRecord> = {}): PlayerRecord {
  return { ...createPlayerRecord(TEST_PLAYER, 0), ...overrides };
}
