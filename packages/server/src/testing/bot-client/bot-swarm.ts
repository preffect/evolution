// N bots against one running server (docs/TESTING.md §8.4). Every bot gets its own socket
// (identity `bot_<seed>_<index>` as `?clientId=`, so a rerun with the same seed takes the same
// seats), its own pilot on the stream `bot_<index>` forked from the swarm seed, and its own
// timing pair. `start()` connects and seats every bot before any of them ticks, so the swarm's
// first inputs all land on a room that already knows every bot.

import type { GameInput, GameSnapshot, PlayerId } from '@evolution/shared';
import { CLIENT_ID_QUERY_PARAMETER } from '../../ws/websocket-handler.js';
import type { BotWorldBinding } from './bot-binding.js';
import { createBotIdentity } from './bot-identity.js';
import { createNamedBotPilot } from './bot-pilot.js';
import { BotSession, type BotSessionStats } from './bot-session.js';
import type { BotClientTimingFactory } from './bot-timing.js';
import type { BotTransportFactory } from './bot-transport.js';
import { BotClientError } from './errors.js';

export interface BotSwarmOptions {
  /** The server's `/ws` endpoint, e.g. `ws://localhost:4400/ws`. */
  readonly url: string;
  readonly gameId: string;
  /** A positive whole number of bots. */
  readonly botCount: number;
  /** A catalogue name (`strategy-catalog.ts`); every bot in the swarm runs it. */
  readonly strategy: string;
  readonly seed: number;
  /** `hunter` only: hunt this player alone. */
  readonly preyPlayerId?: PlayerId;
  /** How a bot reads the wire snapshot and builds its input; the echo binding until #98. */
  readonly binding: BotWorldBinding<GameInput, GameSnapshot>;
  readonly createTiming: BotClientTimingFactory;
  readonly connect: BotTransportFactory;
}

export interface BotSwarm {
  readonly gameId: string;
  /** The sessions, in bot index order; empty until `start()` has connected them. */
  bots(): readonly BotSession[];
  /** Connects, seats and then starts every bot; rejects (and stops what connected) on the first failure. */
  start(): Promise<void>;
  stop(): void;
  stats(): BotSessionStats[];
  /** Resolves once every bot's client tick has reached `tick`. */
  whenAllReachedTick(tick: number): Promise<void>;
}

/** The bot's socket URL: the swarm's `/ws` URL carrying the bot's identity as `?clientId=`. */
export function socketUrlFor(baseUrl: string, playerId: PlayerId): string {
  const url = new URL(baseUrl);
  url.searchParams.set(CLIENT_ID_QUERY_PARAMETER, playerId);
  return url.toString();
}

function validateBotCount(botCount: number): void {
  if (!Number.isInteger(botCount) || botCount < 1) {
    throw new BotClientError(`a swarm needs a positive whole number of bots, not ${botCount}`);
  }
}

export function createBotSwarm(options: BotSwarmOptions): BotSwarm {
  validateBotCount(options.botCount);
  const { url, gameId, botCount, strategy, seed, preyPlayerId, binding, createTiming, connect } = options;
  let sessions: BotSession[] = [];

  const connectBot = async (playerIndex: number): Promise<BotSession> => {
    const identity = createBotIdentity(seed, playerIndex);
    const pilot = createNamedBotPilot({
      behavior: strategy,
      seed,
      playerIndex,
      playerId: identity.playerId,
      binding,
      preyPlayerId,
    });
    const transport = await connect(socketUrlFor(url, identity.playerId));
    return new BotSession({ identity, gameId, pilot, transport, timing: createTiming() });
  };

  const stop = (): void => {
    for (const session of sessions) session.stop();
  };

  return {
    gameId,
    bots: () => sessions,
    async start() {
      try {
        sessions = await Promise.all(Array.from({ length: botCount }, (_unused, index) => connectBot(index)));
        await Promise.all(sessions.map((session) => session.join()));
      } catch (error) {
        stop();
        throw error;
      }
      for (const session of sessions) session.start();
    },
    stop,
    stats: () => sessions.map((session) => session.stats()),
    whenAllReachedTick: async (tick) => {
      await Promise.all(sessions.map((session) => session.waitForTick(tick)));
    },
  };
}
