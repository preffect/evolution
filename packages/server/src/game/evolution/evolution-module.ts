// The Evolution `GameModule` (docs/ARCHITECTURE.md §3): wiring only. It coalesces inputs, drives
// the in-process bots, runs the recorded step, serialises and exposes the debug handle; every
// decision lives in the subsystems. One `WorldState` for the room's lifetime (a rematch resets it
// in place), one live balance copy patched only by `debug_set_balance`, and the streams built
// from `config.seed` (docs/DETERMINISM.md §3): the factory never receives a `RandomSource`.

import { DEFAULT_BALANCE, type GameEffect, type GameInput, type GameSnapshot, type PlayerId } from '@evolution/shared';
import type { GameModule, GameModuleFactory, RoomInitOptions } from '../game-module.js';
import { createEvolutionBotRoster, driveBots } from './bots/evolution-bots.js';
import { createEvolutionDebugHandle, type EvolutionDebugHandle } from './debug/evolution-debug-handle.js';
import { runRecordedStep } from './replay/recorded-step.js';
import { ReplayRecorder } from './replay/replay-recorder.js';
import { FoodDeltaTracker } from './serialize/food-delta-tracker.js';
import { serializeDeltaSnapshot, serializeFullSnapshot } from './serialize/serialize.js';
import { addPlayerToWorld, removePlayerFromWorld } from './session/membership.js';
import type { PlayerIdentity } from './session/players.js';
import { submitPlayerInput } from './simulation/input-coalescing.js';
import { createWorld } from './world/create-world.js';
import { createInputRejectionCounters, type InputRejectionCounters, type WorldState } from './world/world-state.js';

export interface EvolutionModule extends GameModule<GameInput, GameSnapshot> {
  /** The room's one world; reset in place on a rematch, so the reference is stable. */
  readonly world: WorldState;
  readonly rejections: InputRejectionCounters;
  getDebugHandle(): EvolutionDebugHandle;
}

function rosterOf(options: RoomInitOptions): PlayerIdentity[] {
  return options.playerIds.map((playerId) => ({
    playerId,
    playerName: options.playerNames[playerId] ?? playerId,
    avatarIndex: options.avatarAssignments[playerId] ?? 0,
  }));
}

export function createEvolutionModule(options: RoomInitOptions): EvolutionModule {
  const rejections = createInputRejectionCounters();
  const world = createWorld({
    seed: options.config.seed,
    config: options.config,
    balance: structuredClone(DEFAULT_BALANCE),
    players: rosterOf(options),
  });
  const recorder = new ReplayRecorder(world);
  const foodDelta = new FoodDeltaTracker();
  const bots = createEvolutionBotRoster(world);
  let effectsSinceBroadcast: GameEffect[] = [];

  const submitInput = (playerId: PlayerId, input: GameInput): void => {
    submitPlayerInput(world, playerId, input, rejections);
  };
  const addPlayer = (playerId: PlayerId, avatarIndex: number, playerName: string): void => {
    const identity: PlayerIdentity = { playerId, playerName, avatarIndex };
    if (addPlayerToWorld(world, identity, rejections)) {
      recorder.recordJoin(world, identity);
    }
  };
  const removePlayer = (playerId: PlayerId): void => {
    if (removePlayerFromWorld(world, playerId)) {
      recorder.recordLeave(world, playerId);
    }
  };
  const debugHandle = createEvolutionDebugHandle({
    world,
    recorder,
    rejections,
    bots,
    membership: { addPlayer, removePlayer },
  });

  return {
    world,
    rejections,
    submitInput,
    addPlayer,
    removePlayer,
    reduceGameState: () => {
      driveBots(bots, world, submitInput);
      effectsSinceBroadcast.push(...runRecordedStep(world, recorder, rejections));
    },
    serializeRoomState: () => {
      const snapshot = serializeDeltaSnapshot(world, foodDelta, effectsSinceBroadcast);
      effectsSinceBroadcast = [];
      return snapshot;
    },
    serializeFullState: () => ({ snapshot: serializeFullSnapshot(world), balance: world.balance }),
    getDebugHandle: () => debugHandle,
  };
}

/** What `index.ts` hands the lobby (docs/ARCHITECTURE.md §10). */
export const evolutionModuleFactory: GameModuleFactory = createEvolutionModule;
