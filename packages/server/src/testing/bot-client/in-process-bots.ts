// The bots a game module drives itself (`debug_spawn_bot`, docs/ARCHITECTURE.md §8): a roster
// of pilots the module steps before each tick. The module owns the players (it adds and removes
// them); the roster owns the strategies and their streams, and mints the bots' identities.

import { createSeededRandom, type PlayerId } from '@evolution/shared';
import { DebugRequestError } from '../../game/debug/debug-request-error.js';
import type { BotSpawnRequest, SpawnedBot } from '../../game/debug/simulation-debug-handle.js';
import { UnknownBotStrategyError, createStrategyByName } from '../gameplay/strategies/strategy-catalog.js';
import type { BotWorldBinding } from './bot-binding.js';
import { botStreamLabel, createBotIdentity } from './bot-identity.js';
import { createBotPilot, type BotPilot } from './bot-pilot.js';

export interface InProcessBotRoster<Input, Snapshot> {
  /** Builds the bot's pilot and identity; the caller adds the player to the module. */
  spawn(request: BotSpawnRequest): SpawnedBot;
  /** Forgets the bot; the caller removes the player. Throws `DebugRequestError` for a non-bot. */
  remove(playerId: PlayerId): SpawnedBot;
  list(): readonly SpawnedBot[];
  /** Every bot decides on `snapshot` for `tick`; each input goes through `submit`. */
  driveTick(snapshot: Snapshot, tick: number, submit: (playerId: PlayerId, input: Input) => void): void;
}

interface RosterEntry<Input, Snapshot> {
  readonly bot: SpawnedBot;
  readonly pilot: BotPilot<Input, Snapshot>;
}

export function createInProcessBotRoster<Input, Snapshot>(
  binding: BotWorldBinding<Input, Snapshot>,
): InProcessBotRoster<Input, Snapshot> {
  const entries = new Map<PlayerId, RosterEntry<Input, Snapshot>>();
  let spawnedCount = 0;

  const buildPilot = (request: BotSpawnRequest, index: number, playerId: PlayerId): BotPilot<Input, Snapshot> => {
    try {
      const createStrategy = createStrategyByName(request.behavior, binding.perception, {
        preyPlayerId: request.preyPlayerId,
      });
      const random = createSeededRandom(request.seed).fork(botStreamLabel(index));
      return createBotPilot({ playerIndex: index, playerId, seed: request.seed, random, binding, createStrategy });
    } catch (error) {
      if (error instanceof UnknownBotStrategyError) throw new DebugRequestError(error.message);
      throw error;
    }
  };

  return {
    spawn(request) {
      const index = spawnedCount;
      const identity = createBotIdentity(request.seed, index);
      const pilot = buildPilot(request, index, identity.playerId);
      spawnedCount += 1;
      const bot: SpawnedBot = { ...identity, behavior: pilot.strategyName };
      entries.set(bot.playerId, { bot, pilot });
      return bot;
    },
    remove(playerId) {
      const entry = entries.get(playerId);
      if (entry === undefined) throw new DebugRequestError(`"${playerId}" is not a bot spawned in this game`);
      entries.delete(playerId);
      return entry.bot;
    },
    list: () => [...entries.values()].map((entry) => entry.bot),
    driveTick(snapshot, tick, submit) {
      for (const { pilot } of entries.values()) {
        const input = pilot.decide(snapshot, tick);
        if (input !== null) submit(pilot.playerId, input);
      }
    },
  };
}
