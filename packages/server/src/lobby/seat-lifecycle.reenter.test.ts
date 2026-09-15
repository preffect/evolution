import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLIENT_MESSAGE_TYPE, DISCONNECT_GRACE_MS, SERVER_MESSAGE_TYPE } from '@evolution/shared';
import {
  createPendingGameLobby,
  createSpyGameModule,
  createTestLobby,
  hostTestGame,
  sentTypesTo,
} from '../testing/builders.js';

// `join_game` for the room the player already holds (#335, docs/architecture/wire-contract.md §4): a re-entry, never a
// second late join. Driven through the lobby's handlers, the way the router drives it.

/** A started game alice hosts and bob plays in, with the spy module the room runs on. */
function createHeldRoomLobby() {
  const modules: ReturnType<typeof createSpyGameModule>[] = [];
  const fixture = createTestLobby({
    gameFactory: () => {
      const module = createSpyGameModule();
      modules.push(module);
      return module;
    },
  });
  const alice = fixture.join('alice');
  const bob = fixture.join('bob');
  const gameId = hostTestGame(fixture, alice, {});
  const rejoin = { type: CLIENT_MESSAGE_TYPE.joinGame, gameId };
  fixture.handlers.onJoinGame(bob, rejoin);
  fixture.handlers.onStartGame(alice, { type: CLIENT_MESSAGE_TYPE.startGame, gameId });
  const room = fixture.lobby.getActiveRoom(gameId)!;
  return { ...fixture, alice, bob, rejoin, room, module: modules[0]! };
}

describe('seat-lifecycle: join_game for the room already held (#335)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a connected player re-enters: game_state resent, no second roster entry, module join or player_joined', () => {
    const fixture = createHeldRoomLobby();
    const sentToAlice = fixture.sent['alice']!.length;
    fixture.handlers.onJoinGame(fixture.bob, fixture.rejoin);
    expect(fixture.room.allPlayerIds).toEqual(['alice', 'bob']);
    expect(fixture.module.addPlayer).not.toHaveBeenCalled();
    expect(fixture.lobby.listGames()[0]?.players.map((player) => player.playerId)).toEqual(['alice', 'bob']);
    expect(fixture.sent['bob']!.at(-1)).toMatchObject({
      type: SERVER_MESSAGE_TYPE.gameState,
      playerId: 'bob',
      playerIds: ['alice', 'bob'],
    });
    expect(fixture.sent['alice']).toHaveLength(sentToAlice);
    fixture.room.stop();
  });

  it('a dropped player re-enters: the grace timer is cancelled and the seat is attached again', () => {
    vi.useFakeTimers();
    const fixture = createHeldRoomLobby();
    fixture.lobby.handleDisconnect(fixture.bob);
    fixture.handlers.onJoinGame(fixture.bob, fixture.rejoin);
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS + 1);
    expect(fixture.room.allPlayerIds).toEqual(['alice', 'bob']);
    expect(fixture.room.disconnectedPlayers.has('bob')).toBe(false);
    expect(fixture.room.playerConnections.get('bob')).toBe(fixture.bob);
    expect(fixture.module.addPlayer).not.toHaveBeenCalled();
    expect(fixture.module.removePlayer).not.toHaveBeenCalled();
    expect(sentTypesTo(fixture.sent, 'bob').at(-1)).toBe(SERVER_MESSAGE_TYPE.gameState);
    fixture.room.stop();
  });

  it('a pending seat is kept as it is, even when the game is full: no error, nothing sent', () => {
    const fixture = createPendingGameLobby(2);
    const bob = fixture.join('bob');
    const join = { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId };
    fixture.handlers.onJoinGame(bob, join);
    const sentToBob = fixture.sent['bob']!.length;
    fixture.handlers.onJoinGame(bob, join);
    expect(fixture.lobby.listGames()[0]?.players.map((player) => player.playerId)).toEqual(['alice', 'bob']);
    expect(fixture.sent['bob']).toHaveLength(sentToBob);
  });

  it('a join for another room is not a re-entry: the late join still runs', () => {
    const fixture = createHeldRoomLobby();
    const carol = fixture.join('carol');
    fixture.handlers.onJoinGame(carol, fixture.rejoin);
    expect(fixture.module.addPlayer).toHaveBeenCalledWith('carol', 0, 'carol');
    expect(fixture.room.allPlayerIds).toEqual(['alice', 'bob', 'carol']);
    fixture.room.stop();
  });
});
