// `MultiplayerService` back to the lobby (#219, docs/ui/overlays.md §3.6): on leave, on the user's own
// disconnect, and on a dropped socket only once the server's first answer after the reopen shows the
// seat is gone. The transport is a stub, so each lifecycle event is driven by hand.

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
  type ServerMessage,
} from '@evolution/shared';
import { createTransportStub } from '../../testing/transport-stub';
import { LOBBY_NOTICE, MultiplayerService } from './multiplayer.service';
import { SOCKET_LIFECYCLE, WebSocketService } from './websocket.service';

const ROOM = gameId('g1');
const ALICE = playerId('alice');
const lobbyUpdateMessage: ServerMessage = { type: SERVER_MESSAGE_TYPE.lobbyUpdate, games: [] };

function gameStateMessage(tick: number): ServerMessage {
  return {
    type: SERVER_MESSAGE_TYPE.gameState,
    gameId: ROOM,
    playerId: ALICE,
    snapshot: createTestSnapshot({ tick }),
    balance: DEFAULT_BALANCE,
    config: createTestSessionConfig(),
    playerIds: [ALICE],
    avatarAssignments: { alice: 0 },
  };
}

/** A service in a room over a stubbed transport. */
function serviceInRoom() {
  const transport = createTransportStub();
  TestBed.configureTestingModule({ providers: [{ provide: WebSocketService, useValue: transport }] });
  const service = TestBed.inject(MultiplayerService);
  service.joinLobby('Alice', 2);
  transport.messages.next(gameStateMessage(7));
  expect(service.inGame()).toBe(true);
  return { transport, service };
}

function expectRoomCleared(service: MultiplayerService): void {
  expect(service.phase()).toBe('lobby');
  expect(service.gameId()).toBeNull();
  expect(service.playerId()).toBeNull();
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

  it('re-announces nothing after a drop in the lobby, where there is no seat to recover', () => {
    const { transport, service } = serviceInRoom();
    service.leave();
    transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.closed, isUserInitiated: false });
    transport.send.mockClear();
    transport.lifecycle.next({ kind: SOCKET_LIFECYCLE.opened });
    expect(transport.send).not.toHaveBeenCalled();
    transport.messages.next(lobbyUpdateMessage);
    expect(service.lobbyNotice()).toBeNull();
  });
});
