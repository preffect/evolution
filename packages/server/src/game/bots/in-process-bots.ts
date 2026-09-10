// The bots a game module drives itself (`debug_spawn_bot`, docs/ARCHITECTURE.md §8): a roster
// of pilots the module steps before each tick. The module owns the players (it adds and removes
// them); the roster owns the strategies and their streams, and mints the bots' identities under
// the in-process prefix (`sim_bot_<seed>_<index>`), a namespace no wire bot can reach.

import type { PlayerId } from '@evolution/shared';
import { DebugRequestError } from '../debug/debug-request-error.js';
import type { BotSpawnRequest, SpawnedBot } from '../debug/simulation-debug-handle.js';
import type { BotWorldBinding } from './bot-binding.js';
import { createBotIdentity } from './bot-identity.js';
import { createNamedBotPilot, type BotPilot } from './bot-pilot.js';

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
  /** Indices are never reused, so a removed bot's id stays retired for the life of the room. */
  let spawnedCount = 0;

  return {
    spawn(request) {
      const playerIndex = spawnedCount;
      const identity = createBotIdentity('inProcess', request.seed, playerIndex);
      const pilot = createNamedBotPilot({ ...request, playerIndex, playerId: identity.playerId, binding });
      spawnedCount += 1;
      const bot: SpawnedBot = { ...identity, behavior: request.behavior };
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
