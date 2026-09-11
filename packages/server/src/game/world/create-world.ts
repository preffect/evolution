// Builds a round's world (docs/ARCHITECTURE.md §2, docs/DETERMINISM.md §3): forks the server
// streams from the round seed, places the gel patches, spawns every roster member by safe
// placement (join order), then runs the initial fill. Both the room's first round and every
// rematch come through here; a rematch passes the incremented seed and the continued counters.

import { RANDOM_STREAM, ROUND_PHASE, type BalanceConfig, type GameSessionConfig } from '@evolution/shared';
import { createPlayerRecord, spawnCellForPlayer, type PlayerIdentity } from '../session/players.js';
import { updateLeaderboard } from '../session/leaderboard.js';
import { placeGelPatches } from '../simulation/zones.js';
import { runInitialFill } from '../simulation/spawner.js';
import { roundTimeLeftMsAt } from '../simulation/round-clock.js';
import type { SpawnerState } from './entities.js';
import { forkServerStreams, resumeStreams, storeStreams } from './streams.js';
import { createInputRejectionCounters, type StepContext, type WorldState } from './world-state.js';

export interface CreateWorldOptions {
  readonly seed: number;
  readonly config: GameSessionConfig;
  readonly balance: BalanceConfig;
  /** The roster in join order. */
  readonly players: readonly PlayerIdentity[];
  /** Continued across a rematch so the client's interpolation and food store never see a reset. */
  readonly startTick?: number;
  readonly nextEntityNumber?: number;
}

const FIRST_ENTITY_NUMBER = 1;
/** A room's first round starts at tick 0; a rematch continues the counter. */
const FIRST_TICK = 0;

function createSpawnerState(): SpawnerState {
  return { accumulator: 0, spawnedCount: 0, isEnabled: true };
}

/** An empty world with fresh streams and gel patches: what every cell and mote is added to. */
function createEmptyWorld(options: CreateWorldOptions): WorldState {
  const startTick = options.startTick ?? FIRST_TICK;
  const firstEntityNumber = options.nextEntityNumber ?? FIRST_ENTITY_NUMBER;
  const world: WorldState = {
    tick: startTick,
    seed: options.seed,
    roundStartTick: startTick,
    roundPhase: ROUND_PHASE.playing,
    roundTimeLeftMs: 0,
    config: options.config,
    balance: options.balance,
    gelPatches: [],
    cells: [],
    food: [],
    dnaFragments: [],
    players: [],
    wildSeats: [],
    leaderboard: [],
    spawners: { food: createSpawnerState(), dnaFragments: createSpawnerState() },
    random: forkServerStreams(options.seed),
    nextEntityNumber: firstEntityNumber,
    roundFirstEntityNumber: firstEntityNumber,
    effects: [],
  };
  world.roundTimeLeftMs = roundTimeLeftMsAt(world, world.tick);
  return world;
}

export function createWorld(options: CreateWorldOptions): WorldState {
  const world = createEmptyWorld(options);
  const streams = resumeStreams(world);
  world.gelPatches = placeGelPatches(streams[RANDOM_STREAM.zones], options.balance);
  for (const identity of options.players) {
    const player = createPlayerRecord(identity, world.players.length);
    world.players.push(player);
    spawnCellForPlayer(world, player, options.balance.growth.CELL_STARTING_MASS, streams[RANDOM_STREAM.spawnPlacement]);
  }
  const context: StepContext = {
    balance: options.balance,
    streams,
    effects: world.effects,
    rejections: createInputRejectionCounters(),
  };
  runInitialFill(world, context);
  storeStreams(world, streams);
  updateLeaderboard(world);
  return world;
}
