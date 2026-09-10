import { describe, expect, it } from 'vitest';
import {
  CLIENT_MESSAGE_TYPE,
  MAX_TICKS_PER_ADVANCE,
  SERVER_MESSAGE_TYPE,
  TICK_INTERVAL_MS,
  createSeededRandom,
  createTestSessionConfig,
  createTestSnapshot,
  gameId as brandGameId,
  playerId,
} from '@evolution/shared';
import type { GameSnapshot, ServerMessage } from '@evolution/shared';
import { createTestBotIdentity, createFakeBotTransport, TEST_SEED } from '../bot-builders.js';
import { createManualRoomTiming } from '../builders.js';
import { createScriptedStrategy } from '../gameplay/bots.js';
import { idle, targetPoint, type PlayerScript } from '../gameplay/scripts.js';
import { echoBotBinding } from './bot-binding.js';
import { createBotPilot } from './bot-pilot.js';
import { BotSession } from './bot-session.js';
import { BotClientError } from './errors.js';

const GAME_ID = 'game_1';
const identity = createTestBotIdentity();

function gameState(snapshot: GameSnapshot = createTestSnapshot()): ServerMessage {
  return {
    type: SERVER_MESSAGE_TYPE.gameState,
    gameId: brandGameId(GAME_ID),
    playerId: identity.playerId,
    snapshot,
    balance: {} as never,
    config: createTestSessionConfig(),
    playerIds: [identity.playerId],
    avatarAssignments: {},
  };
}

function gameSnapshot(snapshot: GameSnapshot): ServerMessage {
  return { type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot };
}

function sessionRunning(script: PlayerScript<unknown> = targetPoint(1, 2)) {
  const transport = createFakeBotTransport();
  const timing = createManualRoomTiming();
  const pilot = createBotPilot({
    playerIndex: 0,
    playerId: identity.playerId,
    seed: TEST_SEED,
    random: createSeededRandom(TEST_SEED),
    binding: echoBotBinding,
    createStrategy: createScriptedStrategy('scripted', script),
  });
  const session = new BotSession({ identity, gameId: GAME_ID, pilot, transport, timing });
  const tick = (times = 1) => {
    timing.clock.advanceMilliseconds(TICK_INTERVAL_MS * times);
    timing.ticker.fire();
  };
  const inputsSent = () => transport.sent.filter((message) => message.type === CLIENT_MESSAGE_TYPE.playerInput);
  return { session, transport, timing, tick, inputsSent };
}

/** A seated session: joined on a `game_state` and ticking. */
function seatedSession(script?: PlayerScript<unknown>) {
  const fixture = sessionRunning(script);
  const joined = fixture.session.join();
  fixture.transport.receive(gameState());
  fixture.session.start();
  return { ...fixture, joined };
}

describe('bot session: joining', () => {
  it('announces itself in the lobby, joins the game and is seated by a game_state', async () => {
    const { session, transport } = sessionRunning();
    const joined = session.join();
    expect(transport.sent).toEqual([
      { type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: identity.playerName, avatarIndex: identity.avatarIndex },
      { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: GAME_ID },
    ]);
    transport.receive(gameState());
    await expect(joined).resolves.toBeUndefined();
    expect(session.stats().snapshotsReceived).toBe(1);
  });

  it('is seated by a game_started when it joined a pending game', async () => {
    const { session, transport } = sessionRunning();
    const joined = session.join();
    transport.receive({ type: SERVER_MESSAGE_TYPE.lobbyUpdate, games: [] });
    transport.receive({
      type: SERVER_MESSAGE_TYPE.gameStarted,
      gameId: brandGameId(GAME_ID),
      playerId: identity.playerId,
      playerIds: [],
      isHost: false,
      config: createTestSessionConfig(),
    });
    await expect(joined).resolves.toBeUndefined();
  });

  it("rejects with the server's error while joining and remembers it", async () => {
    const { session, transport } = sessionRunning();
    const joined = session.join();
    transport.receive({ type: SERVER_MESSAGE_TYPE.error, message: 'Game not found' });
    await expect(joined).rejects.toThrow(BotClientError);
    await expect(joined).rejects.toThrow(/bot_42_0 could not join: Game not found/);
    expect(session.stats()).toMatchObject({ errorsReceived: 1, lastError: 'Game not found' });
  });

  it('rejects when the connection closes before it is seated', async () => {
    const { session, transport } = sessionRunning();
    const joined = session.join();
    transport.disconnect();
    await expect(joined).rejects.toThrow(/connection closed/);
  });
});

describe('bot session: the client tick', () => {
  it('sends exactly one player_input per client tick, sequence = tick, decided from the latest snapshot', () => {
    const { tick, inputsSent, session } = seatedSession();
    tick(3);
    expect(inputsSent().map((message) => (message as { payload: { sequence: number } }).payload.sequence)).toEqual([
      1, 2, 3,
    ]);
    expect(inputsSent()[0]).toMatchObject({ payload: { targetX: 1, targetY: 2 } });
    expect(session.stats()).toMatchObject({ clientTick: 3, inputsSent: 3, decisions: 3, lastSequence: 3 });
  });

  it('holds until the first snapshot arrives, then decides', () => {
    const { session, transport, tick, inputsSent } = sessionRunning();
    session.start();
    tick(2);
    expect(inputsSent()).toEqual([]);
    expect(session.stats()).toMatchObject({ clientTick: 2, decisions: 0 });
    transport.receive(gameSnapshot(createTestSnapshot({ tick: 9 })));
    tick();
    expect(inputsSent()).toHaveLength(1);
    expect(inputsSent()[0]).toMatchObject({ payload: { sequence: 3 } });
  });

  it('sends nothing while the strategy holds but still counts its decisions', () => {
    const { tick, inputsSent, session } = seatedSession(idle);
    tick(2);
    expect(inputsSent()).toEqual([]);
    expect(session.stats()).toMatchObject({ decisions: 2, inputsSent: 0 });
  });

  it('discards the time that passed before start() and records ticks dropped after a stall', () => {
    const { session, transport, timing, tick, inputsSent } = sessionRunning();
    transport.receive(gameState());
    timing.clock.advanceMilliseconds(TICK_INTERVAL_MS * 4);
    session.start();
    timing.ticker.fire();
    expect(inputsSent()).toEqual([]);
    tick(MAX_TICKS_PER_ADVANCE + 2);
    expect(session.stats()).toMatchObject({ clientTick: MAX_TICKS_PER_ADVANCE, droppedTicks: 2 });
  });

  it('stop() halts the tick and closes the transport', () => {
    const { session, transport, tick, inputsSent } = seatedSession();
    session.stop();
    tick();
    expect(inputsSent()).toEqual([]);
    expect(transport.isClosed()).toBe(true);
  });
});

describe('bot session: waiting', () => {
  it('waitForSnapshot answers the latest snapshot now when it matches, else the next matching one', async () => {
    const { session, transport } = seatedSession();
    const isTickFive = (snapshot: GameSnapshot) => snapshot.tick === 5;
    await expect(session.waitForSnapshot((snapshot) => snapshot.tick === 0)).resolves.toMatchObject({ tick: 0 });
    const later = session.waitForSnapshot(isTickFive);
    transport.receive(gameSnapshot(createTestSnapshot({ tick: 4 })));
    transport.receive(gameSnapshot(createTestSnapshot({ tick: 5 })));
    await expect(later).resolves.toMatchObject({ tick: 5 });
  });

  it('waitForTick resolves once the client tick reaches the tick asked for', async () => {
    const { session, tick } = seatedSession();
    const reached = session.waitForTick(2);
    tick();
    await expect(session.waitForTick(1)).resolves.toBeUndefined();
    tick();
    await expect(reached).resolves.toBeUndefined();
  });

  it('ignores server messages that are not its concern', () => {
    const { session, transport } = seatedSession();
    transport.receive({ type: SERVER_MESSAGE_TYPE.playerJoined, playerId: playerId('x'), avatarIndex: 0 });
    transport.receive({ type: SERVER_MESSAGE_TYPE.playerDisconnected, playerId: playerId('x') });
    expect(session.stats()).toMatchObject({ snapshotsReceived: 1, errorsReceived: 0 });
  });
});
