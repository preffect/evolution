// Integration (docs/TESTING.md §2, §8.4): two bots over real sockets against a real in-process
// server on the echo module, 300 ticks on manual clocks. Every tick is strictly ordered (bots
// decide → inputs land → the room steps and broadcasts), so the run reads no wall clock and the
// last echoed inputs are exactly what an offline pilot with the same seed and index decides.
// Run with `./validate.sh integration`.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLIENT_MESSAGE_TYPE, TICK_INTERVAL_MS, createTestSessionConfig } from '@evolution/shared';
import type { GameInput, PlayerId } from '@evolution/shared';
import { echoBotBinding } from '../../game/bots/bot-binding.js';
import { createNamedBotPilot } from '../../game/bots/bot-pilot.js';
import { defaultGameModuleFactory, type GameModuleFactory } from '../../game/game-module.js';
import { captureManualTimings } from '../bot-builders.js';
import { echoedInput, type EchoSnapshot } from '../gameplay/echo-adapter.js';
import { nextServerMessage, openTestSocket, startTestWebSocketServer } from '../socket-builders.js';
import type { BotSession } from './bot-session.js';
import { createBotSwarm, type BotSwarm } from './bot-swarm.js';
import { BotClientError } from './errors.js';
import { createWebSocketTransport } from './web-socket-transport.js';

const TICKS = 300;
const BOT_COUNT = 2;
const SEED = 42;
const STRATEGY = 'wander';

interface LandingWaiter {
  readonly playerIds: readonly string[];
  readonly sequence: number;
  readonly resolve: () => void;
}

/** The echo factory with a hook that resolves once every named player's input of a sequence has landed. */
function landingEchoFactory() {
  const landed = new Map<string, number>();
  const waiters: LandingWaiter[] = [];
  const hasLanded = (playerIds: readonly string[], sequence: number) =>
    playerIds.every((playerId) => (landed.get(playerId) ?? -1) >= sequence);
  const gameFactory: GameModuleFactory = (options) => {
    const module = defaultGameModuleFactory(options);
    return {
      ...module,
      submitInput: (playerId: PlayerId, input: GameInput) => {
        module.submitInput(playerId, input);
        landed.set(playerId, input.sequence);
        for (const waiter of waiters.splice(0)) {
          if (hasLanded(waiter.playerIds, waiter.sequence)) waiter.resolve();
          else waiters.push(waiter);
        }
      },
    };
  };
  const untilLanded = (playerIds: readonly string[], sequence: number): Promise<void> =>
    hasLanded(playerIds, sequence)
      ? Promise.resolve()
      : new Promise((resolve) => waiters.push({ playerIds, sequence, resolve }));
  return { gameFactory, untilLanded };
}

describe('bot client against a real server', () => {
  let roomTimings: ReturnType<typeof captureManualTimings>;
  let botTimings: ReturnType<typeof captureManualTimings>;
  let landing: ReturnType<typeof landingEchoFactory>;
  let started: Awaited<ReturnType<typeof startTestWebSocketServer>>;
  let swarm: BotSwarm | undefined;

  beforeEach(async () => {
    roomTimings = captureManualTimings();
    botTimings = captureManualTimings();
    landing = landingEchoFactory();
    started = await startTestWebSocketServer({
      gameFactory: landing.gameFactory,
      createRoomTiming: roomTimings.createTiming,
    });
  });

  afterEach(async () => {
    swarm?.stop();
    for (const room of started.lobby.listActiveRooms().values()) room.stop();
    await started.close();
  });

  /** A human host creates and starts a game over the wire; the socket stays open as a spectator. */
  async function hostedGame(): Promise<string> {
    const host = await openTestSocket(`${started.url}?clientId=host`);
    const lobbyUpdate = nextServerMessage(host);
    host.send(JSON.stringify({ type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: 'Host', avatarIndex: 0 }));
    await lobbyUpdate;
    const created = nextServerMessage(host);
    const config = createTestSessionConfig({ maxPlayers: BOT_COUNT + 1 });
    host.send(JSON.stringify({ type: CLIENT_MESSAGE_TYPE.createGame, gameName: 'Bots', config }));
    await created;
    const gameId = started.lobby.listGames()[0]!.gameId;
    const gameStarted = nextServerMessage(host);
    host.send(JSON.stringify({ type: CLIENT_MESSAGE_TYPE.startGame, gameId }));
    await gameStarted;
    return gameId;
  }

  function swarmFor(gameId: string): BotSwarm {
    swarm = createBotSwarm({
      url: started.url,
      gameId,
      botCount: BOT_COUNT,
      strategy: STRATEGY,
      seed: SEED,
      binding: echoBotBinding,
      createTiming: botTimings.createTiming,
      connect: createWebSocketTransport,
    });
    return swarm;
  }

  /** One ordered tick: every bot decides, its input lands, then the room steps and broadcasts. */
  async function orderedTick(botIds: readonly string[], tick: number): Promise<void> {
    for (const timing of botTimings.timings) {
      timing.clock.advanceMilliseconds(TICK_INTERVAL_MS);
      timing.ticker.fire();
    }
    await landing.untilLanded(botIds, tick);
    const roomTiming = roomTimings.timings[0]!;
    roomTiming.clock.advanceMilliseconds(TICK_INTERVAL_MS);
    roomTiming.ticker.fire();
  }

  /** What a pilot with the bot's seed and index decides on tick `TICKS` with no server in between. */
  function offlineLastInput(playerId: PlayerId, playerIndex: number): GameInput | null {
    const pilot = createNamedBotPilot({
      behavior: STRATEGY,
      seed: SEED,
      playerIndex,
      playerId,
      binding: echoBotBinding,
    });
    let input: GameInput | null = null;
    for (let tick = 1; tick <= TICKS; tick += 1) input = pilot.decide({}, tick);
    return input;
  }

  it('seats two bots as normal players and drives 300 ordered ticks through the real protocol', async () => {
    const gameId = await hostedGame();
    const room = started.lobby.getActiveRoom(gameId)!;
    const bots = swarmFor(gameId);
    await bots.start();
    const botIds = bots.bots().map((bot) => bot.playerId);
    expect(room.allPlayerIds).toEqual(['host', ...botIds]);
    expect(botIds.map((playerId) => room.playerNames[playerId])).toEqual(['Bot 0', 'Bot 1']);

    for (let tick = 1; tick <= TICKS; tick += 1) await orderedTick(botIds, tick);
    const isLastInputEchoed = (bot: BotSession) =>
      bot.waitForSnapshot(
        (snapshot) => echoedInput(snapshot as unknown as EchoSnapshot, bot.playerId)?.sequence === TICKS,
      );
    await Promise.all(bots.bots().map(isLastInputEchoed));

    const snapshot = room.getSnapshot() as unknown as EchoSnapshot;
    expect(echoedInput(snapshot, botIds[0]!)).toEqual(offlineLastInput(botIds[0]!, 0));
    expect(echoedInput(snapshot, botIds[1]!)).toEqual(offlineLastInput(botIds[1]!, 1));
    expect(echoedInput(snapshot, botIds[0]!)).not.toEqual(echoedInput(snapshot, botIds[1]!));
    expect(room.getTickCount()).toBe(TICKS);
    for (const stats of bots.stats()) {
      expect(stats).toMatchObject({
        clientTick: TICKS,
        inputsSent: TICKS,
        droppedTicks: 0,
        errorsReceived: 0,
        isConnected: true,
      });
      expect(stats.snapshotsReceived).toBeGreaterThanOrEqual(TICKS);
    }
  });

  it('fails loudly, with the server error, when the game does not exist', async () => {
    const bots = swarmFor('no_such_game');
    const failure = bots.start();
    await expect(failure).rejects.toThrow(BotClientError);
    await expect(failure).rejects.toThrow(/Game not found/);
    // The swarm stops every socket on the first refusal, so only the refusal that won the race is guaranteed recorded.
    expect(bots.stats().some((stats) => stats.lastError === 'Game not found')).toBe(true);
    expect(botTimings.timings.map((timing) => timing.ticker.isStarted())).toEqual([false, false]);
  });
});
