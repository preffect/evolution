import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLIENT_MESSAGE_TYPE,
  DEFAULT_BALANCE,
  SERVER_MESSAGE_TYPE,
  createTestGameInput,
  createTestSessionConfig,
  createTestSnapshot,
} from '@evolution/shared';
import type { GameId, PlayerId, ServerMessage } from '@evolution/shared';
import { MultiplayerService } from './multiplayer.service';
import { WebSocketService } from './websocket.service';

const GAME_ID = 'g1' as GameId;
const ALICE = 'alice' as PlayerId;
const BOB = 'bob' as PlayerId;
const CONFIG = createTestSessionConfig({ maxPlayers: 4 });
const INPUT = createTestGameInput({ sequence: 5 });

function createTransportStub() {
  const messages = new Subject<ServerMessage>();
  return {
    messages,
    connected: signal(false),
    messages$: messages.asObservable(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    drainLatestSnapshot: vi.fn<() => ServerMessage | null>(() => null),
  };
}

describe('MultiplayerService', () => {
  let transport: ReturnType<typeof createTransportStub>;
  let service: MultiplayerService;

  beforeEach(() => {
    transport = createTransportStub();
    TestBed.configureTestingModule({ providers: [{ provide: WebSocketService, useValue: transport }] });
    service = TestBed.inject(MultiplayerService);
  });

  it('forwards the lifecycle and lobby verbs to the transport as typed messages', () => {
    service.connect();
    service.joinLobby('Alice');
    service.updatePlayerInfo('Alicia', 2);
    service.createGame('G', CONFIG);
    service.joinGame('g1');
    service.startGame('g1');
    service.deleteGame('g1');
    service.sendInput(INPUT);
    service.disconnect();
    expect(transport.connect).toHaveBeenCalled();
    expect(transport.disconnect).toHaveBeenCalled();
    expect(transport.send.mock.calls.map(([message]) => message)).toEqual([
      { type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: 'Alice', avatarIndex: 0 },
      { type: CLIENT_MESSAGE_TYPE.updatePlayerInfo, playerName: 'Alicia', avatarIndex: 2 },
      { type: CLIENT_MESSAGE_TYPE.createGame, gameName: 'G', config: CONFIG },
      { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: 'g1' },
      { type: CLIENT_MESSAGE_TYPE.startGame, gameId: 'g1' },
      { type: CLIENT_MESSAGE_TYPE.deleteGame, gameId: 'g1' },
      { type: CLIENT_MESSAGE_TYPE.playerInput, payload: INPUT },
    ]);
  });

  it('mirrors lobby_update into the games signal', () => {
    const games = [{ gameId: GAME_ID, gameName: 'G', players: [], maxPlayers: 4, isStarted: false, creatorId: ALICE }];
    transport.messages.next({ type: SERVER_MESSAGE_TYPE.lobbyUpdate, games });
    expect(service.games()).toEqual(games);
  });

  it('enters the game on game_started with the roster and host flag', () => {
    transport.messages.next({
      type: SERVER_MESSAGE_TYPE.gameStarted,
      gameId: GAME_ID,
      playerId: ALICE,
      playerIds: [ALICE],
      isHost: true,
      config: CONFIG,
    });
    expect(service.inGame()).toBe(true);
    expect(service.isHost()).toBe(true);
    expect(service.gameId()).toBe(GAME_ID);
    expect(service.playerIds()).toEqual([ALICE]);
  });

  it('rebuilds the view from game_state on (re)join', () => {
    transport.messages.next({
      type: SERVER_MESSAGE_TYPE.gameState,
      gameId: GAME_ID,
      playerId: BOB,
      snapshot: createTestSnapshot({ tick: 7 }),
      balance: DEFAULT_BALANCE,
      config: CONFIG,
      playerIds: [ALICE, BOB],
      avatarAssignments: { alice: 0, bob: 1 },
    });
    expect(service.inGame()).toBe(true);
    expect(service.snapshot()).toEqual(createTestSnapshot({ tick: 7 }));
    expect(service.avatarAssignments()).toEqual({ alice: 0, bob: 1 });
  });

  it('replays the retained game_state to a composition root that subscribes late, then stays live', () => {
    const gameState: ServerMessage = {
      type: SERVER_MESSAGE_TYPE.gameState,
      gameId: GAME_ID,
      playerId: BOB,
      snapshot: createTestSnapshot({ tick: 3 }),
      balance: DEFAULT_BALANCE,
      config: CONFIG,
      playerIds: [ALICE, BOB],
      avatarAssignments: {},
    };
    const seenBefore: ServerMessage[] = [];
    service.gameMessages$.subscribe((message) => seenBefore.push(message));
    transport.messages.next(gameState);
    const seenAfter: ServerMessage[] = [];
    service.gameMessages$.subscribe((message) => seenAfter.push(message));
    transport.messages.next({ type: SERVER_MESSAGE_TYPE.error, message: 'later' });
    expect(seenBefore.map((message) => message.type)).toEqual([
      SERVER_MESSAGE_TYPE.gameState,
      SERVER_MESSAGE_TYPE.error,
    ]);
    expect(seenAfter.map((message) => message.type)).toEqual([
      SERVER_MESSAGE_TYPE.gameState,
      SERVER_MESSAGE_TYPE.error,
    ]);
  });

  it('tracks players joining (once) and leaving', () => {
    transport.messages.next({ type: SERVER_MESSAGE_TYPE.playerJoined, playerId: ALICE, avatarIndex: 3 });
    transport.messages.next({ type: SERVER_MESSAGE_TYPE.playerJoined, playerId: ALICE, avatarIndex: 3 });
    transport.messages.next({ type: SERVER_MESSAGE_TYPE.playerJoined, playerId: BOB, avatarIndex: 1 });
    expect(service.playerIds()).toEqual([ALICE, BOB]);
    expect(service.avatarAssignments()).toEqual({ alice: 3, bob: 1 });
    transport.messages.next({ type: SERVER_MESSAGE_TYPE.playerDisconnected, playerId: ALICE });
    expect(service.playerIds()).toEqual([BOB]);
  });

  it('stores a snapshot from the message stream and surfaces errors', () => {
    transport.messages.next({ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: createTestSnapshot({ tick: 1 }) });
    transport.messages.next({ type: SERVER_MESSAGE_TYPE.error, message: 'nope' });
    expect(service.snapshot()).toEqual(createTestSnapshot({ tick: 1 }));
    expect(service.lastError()).toBe('nope');
  });

  it('latestSnapshot drains the transport fast-path and updates the signal', () => {
    transport.drainLatestSnapshot.mockReturnValueOnce({
      type: SERVER_MESSAGE_TYPE.gameSnapshot,
      snapshot: createTestSnapshot({ tick: 2 }),
    });
    expect(service.latestSnapshot()).toEqual(createTestSnapshot({ tick: 2 }));
    expect(service.snapshot()).toEqual(createTestSnapshot({ tick: 2 }));
    expect(service.latestSnapshot()).toBeNull();
  });
});
