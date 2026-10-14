// Test builders for the simulation records (docs/testing/tiers-and-builders.md §4): a world, a step context and a
// player record with defaults, so a shape change is one edit. Builder defaults are the only
// tolerated inline test numbers.

import {
  DEFAULT_BALANCE,
  GAME_ERA_ORDER,
  createTestSessionConfig,
  playerId,
  withErasInPlay,
  type BalanceConfig,
  type GameEra,
  type GiantSpecies,
} from '@evolution/shared';
import { createPlayerRecord, type PlayerIdentity } from '../game/session/players.js';
import { clearFoodAndStopSpawners } from '../game/simulation/spawner.js';
import { createWorld } from '../game/world/create-world.js';
import type { PlayerRecord } from '../game/world/entities.js';
import { removeSeatedCells } from '../game/wild/wild-seats.js';
import { resumeStreams } from '../game/world/streams.js';
import { createInputRejectionCounters, type StepContext, type WorldState } from '../game/world/world-state.js';

const TEST_SEED = 42;
/** The balance key of the giants seated at world creation, typed so a rename breaks every test that names it. */
export const GIANT_SPECIES_IN_DISH_LEAF = 'GIANT_SPECIES_IN_DISH' satisfies keyof BalanceConfig['giants'];

/** `DEFAULT_BALANCE` seating exactly `species` at world creation (docs/ecology/giants.md §3.5.9). */
export function balanceSeatingGiants(species: readonly GiantSpecies[]): BalanceConfig {
  return { ...DEFAULT_BALANCE, giants: { ...DEFAULT_BALANCE.giants, [GIANT_SPECIES_IN_DISH_LEAF]: species } };
}

/**
 * `DEFAULT_BALANCE` with no giant in the dish (docs/ecology/giants.md §3.5.17): for a seeded-world row about something
 * else, which a giant would change the meaning of.
 */
export const NO_GIANTS_BALANCE: BalanceConfig = balanceSeatingGiants([]);

/** The game's length with the colonies on (docs/game-design/phases.md §14.2.3): every era is reachable in it. */
export const COLONIES_ON_ROUND_SECONDS = 1500;

export const TEST_PLAYER: PlayerIdentity = { playerId: playerId('p1'), playerName: 'Alice', avatarIndex: 0 };

export interface TestWorldOptions {
  readonly players?: readonly PlayerIdentity[];
  /** Keep the seeded motes and spawners; off by default so arithmetic is exact. */
  readonly isFilled?: boolean;
  /** Keep the seeded wild and giant seats and their cells (docs/ecology/wild-cells.md §3.3); off by default so `world.cells` is the players'. */
  readonly hasWildSeats?: boolean;
  readonly seed?: number;
  /** The balance the world is built on (a fixture's, e.g. one whose `GIANT_SPECIES_IN_DISH` seats giants). */
  readonly balance?: BalanceConfig;
}

/**
 * A seeded world with one player; the dish is emptied and the spawners are off unless `isFilled`, and the wild and
 * giant seats are removed with their cells unless `hasWildSeats`.
 */
export function createTestWorld(options: TestWorldOptions = {}): WorldState {
  const seed = options.seed ?? TEST_SEED;
  const world = createWorld({
    seed,
    config: createTestSessionConfig({ seed }),
    balance: options.balance ?? DEFAULT_BALANCE,
    players: options.players ?? [TEST_PLAYER],
  });
  if (!options.isFilled) {
    clearFoodAndStopSpawners(world);
  }
  if (!options.hasWildSeats) {
    removeSeatedCells(world);
  }
  return world;
}

/**
 * `createTestWorld` playing `erasInPlay` (every era by default) in a round of `roundDurationSeconds` (the colonies-on
 * game by default, so every era in play is reachable): the world an era test steps or jumps through.
 */
export function createTestWorldInEras(
  erasInPlay: readonly GameEra[] = GAME_ERA_ORDER,
  roundDurationSeconds = COLONIES_ON_ROUND_SECONDS,
  options: Omit<TestWorldOptions, 'balance'> = {},
): WorldState {
  const world = createTestWorld({ ...options, balance: withErasInPlay(erasInPlay) });
  world.config = createTestSessionConfig({ seed: world.seed, roundDurationSeconds });
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
