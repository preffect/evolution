// `MultiplayerService` back to the lobby (#219, docs/ui/overlays.md §3.6): on leave, on the user's own
// disconnect, and on a dropped socket only once the server's first answer after the reopen shows the
// seat is gone. A room that was left stays left while the server still seats the player (#319). The
// transport is a stub, so each lifecycle event is driven by hand.

import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import {
  CLIENT_MESSAGE_TYPE,
  DEFAULT_BALANCE,
  SERVER_MESSAGE_TYPE,
  createTestSessionConfig,
  createTestSnapshot,
  gameId,
  playerId,
  type GameId,
  type ServerMessage,
} from '@evolution/shared';
import { createTransportStub } from '../../testing/transport-stub';
import { LOBBY_NOTICE, MultiplayerService } from './multiplayer.service';
import { SOCKET_LIFECYCLE, WebSocketService } from './websocket.service';

const ROOM = gameId('g1');
const ALICE = playerId('alice');
const lobbyUpdateMessage: ServerMessage = { type: SERVER_MESSAGE_TYPE.lobbyUpdate, games: [] };
const reannouncement = { type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: 'Alice', avatarIndex: 2 };

function gameStateMessage(tick: number, room: GameId = ROOM): ServerMessage {
  return {
    type: SERVER_MESSAGE_TYPE.gameState,
    gameId: room,
    playerId: ALICE,
    snapshot: createTestSnapshot({ tick }),
    balance: DEFAULT_BALANCE,
    config: createTestSessionConfig(),
    playerIds: [ALICE],
    avatarAssignments: { alice: 0 },
  };
}

/** A service in a room over a stubbed transport; `isAnnounced: false` skips the lobby's `joinLobby`. */
function serviceInRoom({ isAnnounced = true } = {}) {
  const transport = createTransportStub();
  TestBed.configureTestingModule({ providers: [{ provide: WebSocketService, useValue: transport }] });
  const service = TestBed.inject(MultiplayerService);
  if (isAnnounced) service.joinLobby('Alice', 2);
  transport.messages.next(gameStateMessage(7));
  expect(service.inGame()).toBe(true);
  return { transport, service };
}

function expectRoomCleared(service: MultiplayerService): void {
  expect(service.phase()).toBe('lobby');
  expect(service.gameId()).toBeNull();
  expect(service.playerId()).toBeNull();
  expect(service.playerIds()).toEqual([]);
  expect(service.avatarAssignments()).toEqual({});
  expect(service.snapshot()).toBeNull();
  expect(service.balance()).toBeNull();
  const replayed: ServerMessage[] = [];
  service.gameMessages$.subscribe((message) => replayed.push(message));
  expect(replayed).toEqual([]);
}

describe('MultiplayerService returning to the lobby', () => {
  it('leaves the room for the lobby and forgets every room fact', () => {
    const { service } = serviceInRoom();
    service.leave();
    expectRoomCleared(service);
    expect(service.lobbyNotice()).toBeNull();
  });

  it('returns to the lobby on the user’s own disconnect', () => {
    const { service } = serviceInRoom();
    service.disconnect();
    expectRoomCleared(service);
  });

  it('returns to the lobby when the transport reports a user-initiated close', () => {
    const { transport, service } = serviceInRoom();
    transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.closed, isUserInitiated: true });
    expectRoomCleared(service);
  });

  it('keeps the round through a dropped socket, and plays on when the reopen resends the room', () => {
    const { transport, service } = serviceInRoom();
    transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.closed, isUserInitiated: false });
    expect(service.inGame()).toBe(true);

    transport.send.mockClear();
    transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.opened });
    // Re-announced, so the server's answer is guaranteed to follow its connect-time game_state.
    expect(transport.send).toHaveBeenCalledWith(reannouncement);
    transport.messages.next(gameStateMessage(9));
    transport.messages.next(lobbyUpdateMessage);
    expect(service.inGame()).toBe(true);
    expect(service.snapshot()?.tick).toBe(9);
    expect(service.lobbyNotice()).toBeNull();
  });

  it('returns to the lobby with a notice when the reopen answers without the room, until the next room', () => {
    const { transport, service } = serviceInRoom();
    transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.closed, isUserInitiated: false });
    transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.opened });
    transport.messages.next(lobbyUpdateMessage);
    expectRoomCleared(service);
    expect(service.lobbyNotice()).toBe(LOBBY_NOTICE.disconnectedFromGame);

    transport.messages.next(gameStateMessage(1));
    expect(service.lobbyNotice()).toBeNull();
  });

  it('returns to the lobby at once when a dropped round reopens with no name to re-announce', () => {
    const { transport, service } = serviceInRoom({ isAnnounced: false });
    transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.closed, isUserInitiated: false });
    transport.send.mockClear();
    transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.opened });
    expect(transport.send).not.toHaveBeenCalled();
    expectRoomCleared(service);
    expect(service.lobbyNotice()).toBe(LOBBY_NOTICE.disconnectedFromGame);
  });

  it('re-announces the name and avatar after a drop in the lobby, so the new connection carries them', () => {
    const { transport, service } = serviceInRoom();
    service.leave();
    transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.closed, isUserInitiated: false });
    transport.send.mockClear();
    transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.opened });
    expect(transport.send).toHaveBeenCalledWith(reannouncement);
    transport.messages.next(lobbyUpdateMessage);
    expect(service.lobbyNotice()).toBeNull();
  });

  describe('a room that was left stays left while the server still seats the player (#319)', () => {
    it('ignores the left room’s game_state (probe A)', () => {
      const { transport, service } = serviceInRoom();
      service.leave();
      transport.messages.next(gameStateMessage(8));
      expectRoomCleared(service);
    });

    it('ignores the left room’s snapshots, balance and roster frames (probe B)', () => {
      const { transport, service } = serviceInRoom();
      service.leave();
      transport.messages.next({ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: createTestSnapshot({ tick: 21 }) });
      transport.messages.next({ type: SERVER_MESSAGE_TYPE.balanceUpdated, balance: DEFAULT_BALANCE });
      transport.messages.next({ type: SERVER_MESSAGE_TYPE.playerJoined, playerId: ALICE, avatarIndex: 3 });
      transport.messages.next({ type: SERVER_MESSAGE_TYPE.playerDisconnected, playerId: ALICE });
      expectRoomCleared(service);
    });

    it('ignores the connect-time game_state after leaving mid-recovery (probe C)', () => {
      const { transport, service } = serviceInRoom();
      transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.closed, isUserInitiated: false });
      transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.opened });
      service.leave();
      transport.messages.next(gameStateMessage(8));
      expectRoomCleared(service);
      expect(service.lobbyNotice()).toBeNull();
    });

    it('lets the next room in: a game_started, or a join back into the room that was left', () => {
      const { transport, service } = serviceInRoom();
      service.leave();
      transport.messages.next({
        type: SERVER_MESSAGE_TYPE.gameStarted,
        gameId: gameId('g2'),
        playerId: ALICE,
        playerIds: [ALICE],
        isHost: true,
        config: createTestSessionConfig(),
      });
      expect(service.inGame()).toBe(true);

      service.leave();
      service.joinGame(ROOM);
      transport.messages.next(gameStateMessage(30));
      expect(service.inGame()).toBe(true);
      expect(service.snapshot()?.tick).toBe(30);
    });
  });
});
