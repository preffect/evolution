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
import { LOBBY_NOTICE, MultiplayerService } from './multiplayer.service';
import { SOCKET_LIFECYCLE, WebSocketService, type SocketLifecycleEvent } from './websocket.service';

const GAME_ID = 'g1' as GameId;
const ALICE = 'alice' as PlayerId;
const BOB = 'bob' as PlayerId;
const CONFIG = createTestSessionConfig({ maxPlayers: 4 });
/** Flow control (#266): the newest snapshot tick the client has applied. */
const ACKNOWLEDGED_TICK = 42;
const INPUT = createTestGameInput({ sequence: 5 });

function createTransportStub() {
  const messages = new Subject<ServerMessage>();
  const lifecycle = new Subject<SocketLifecycleEvent>();
  return {
    messages,
    lifecycle,
    connected: signal(false),
    messages$: messages.asObservable(),
    lifecycle$: lifecycle.asObservable(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
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
    service.acknowledgeSnapshot(ACKNOWLEDGED_TICK);
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
      { type: CLIENT_MESSAGE_TYPE.snapshotAck, tick: ACKNOWLEDGED_TICK },
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

  it('drops the retained game_state on the next game_started, so a new room never replays the old one', () => {
    transport.messages.next({
      type: SERVER_MESSAGE_TYPE.gameState,
      gameId: GAME_ID,
      playerId: BOB,
      snapshot: createTestSnapshot({ tick: 3 }),
      balance: DEFAULT_BALANCE,
      config: CONFIG,
      playerIds: [BOB],
      avatarAssignments: {},
    });
    transport.messages.next({
      type: SERVER_MESSAGE_TYPE.gameStarted,
      gameId: 'g2' as GameId,
      playerId: BOB,
      playerIds: [BOB],
      isHost: true,
      config: CONFIG,
    });
    const seen: ServerMessage[] = [];
    service.gameMessages$.subscribe((message) => seen.push(message));
    expect(seen).toEqual([]);
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

  it('stores a snapshot from the message stream and surfaces errors until dismissed', () => {
    transport.messages.next({ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: createTestSnapshot({ tick: 1 }) });
    transport.messages.next({ type: SERVER_MESSAGE_TYPE.error, message: 'nope' });
    expect(service.snapshot()).toEqual(createTestSnapshot({ tick: 1 }));
    expect(service.lastError()).toBe('nope');
    service.dismissError();
    expect(service.lastError()).toBeNull();
  });

  describe('returning to the lobby (#219)', () => {
    const lobbyUpdateMessage: ServerMessage = { type: SERVER_MESSAGE_TYPE.lobbyUpdate, games: [] };

    function enterRoom(): void {
      transport.messages.next(gameStateMessage(7));
      expect(service.inGame()).toBe(true);
    }

    function expectRoomCleared(): void {
      expect(service.phase()).toBe('lobby');
      expect(service.gameId()).toBeNull();
      expect(service.playerId()).toBeNull();
      expect(service.playerIds()).toEqual([]);
      expect(service.snapshot()).toBeNull();
      expect(service.balance()).toBeNull();
      expect(service.sessionConfig()).toBeNull();
      expect(service.avatarAssignments()).toEqual({});
      const replayed: ServerMessage[] = [];
      service.gameMessages$.subscribe((message) => replayed.push(message));
      expect(replayed).toEqual([]);
    }

    it('leaves the room for the lobby and forgets every room fact', () => {
      enterRoom();
      service.leave();
      expectRoomCleared();
      expect(service.lobbyNotice()).toBeNull();
    });

    it('returns to the lobby on the user’s own disconnect', () => {
      enterRoom();
      service.disconnect();
      expectRoomCleared();
    });

    it('returns to the lobby when the transport reports a user-initiated close', () => {
      enterRoom();
      transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.closed, isUserInitiated: true });
      expectRoomCleared();
    });

    it('keeps the round through a dropped socket, and plays on when the reopen resends the room', () => {
      service.joinLobby('Alice', 2);
      enterRoom();
      transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.closed, isUserInitiated: false });
      expect(service.inGame()).toBe(true);

      transport.send.mockClear();
      transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.opened });
      // Re-announced, so the server's answer is guaranteed to follow its connect-time game_state.
      expect(transport.send).toHaveBeenCalledWith({
        type: CLIENT_MESSAGE_TYPE.joinLobby,
        playerName: 'Alice',
        avatarIndex: 2,
      });
      transport.messages.next(gameStateMessage(9));
      transport.messages.next(lobbyUpdateMessage);
      expect(service.inGame()).toBe(true);
      expect(service.snapshot()?.tick).toBe(9);
      expect(service.lobbyNotice()).toBeNull();
    });

    it('returns to the lobby with a notice when the reopen answers without the room', () => {
      service.joinLobby('Alice');
      enterRoom();
      transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.closed, isUserInitiated: false });
      transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.opened });
      transport.messages.next(lobbyUpdateMessage);
      expectRoomCleared();
      expect(service.lobbyNotice()).toBe(LOBBY_NOTICE.disconnectedFromGame);
      // The next room clears the notice.
      enterRoom();
      expect(service.lobbyNotice()).toBeNull();
    });

    it('re-announces nothing after a drop in the lobby, where there is no seat to recover', () => {
      service.joinLobby('Alice');
      transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.closed, isUserInitiated: false });
      transport.send.mockClear();
      transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.opened });
      expect(transport.send).not.toHaveBeenCalled();
      transport.messages.next(lobbyUpdateMessage);
      expect(service.lobbyNotice()).toBeNull();
    });
  });
});

function gameStateMessage(tick: number): ServerMessage {
  return {
    type: SERVER_MESSAGE_TYPE.gameState,
    gameId: GAME_ID,
    playerId: ALICE,
    snapshot: createTestSnapshot({ tick }),
    balance: DEFAULT_BALANCE,
    config: CONFIG,
    playerIds: [ALICE],
    avatarAssignments: { alice: 0 },
  };
}
