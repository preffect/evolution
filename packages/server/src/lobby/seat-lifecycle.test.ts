import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLIENT_MESSAGE_TYPE,
  DEFAULT_BALANCE,
  DISCONNECT_GRACE_MS,
  SERVER_MESSAGE_TYPE,
  createTestGameInput,
} from '@evolution/shared';
import {
  createActiveGameLobby,
  createPendingGameLobby,
  createTestLobby,
  createTwoPlayerGameLobby,
  hostTestGame,
  sentTypesTo,
  type SentLog,
  type TestLobby,
} from '../testing/builders.js';

// The seat lifecycle is driven through the lobby's handlers, the way the router drives it.

function playerDisconnectedCount(sent: SentLog, playerId: string): number {
  return sentTypesTo(sent, playerId).filter((type) => type === SERVER_MESSAGE_TYPE.playerDisconnected).length;
}

/** Each listed game's name with the ids seated in it. */
function seatsOf(fixture: TestLobby) {
  return fixture.lobby.listGames().map((game) => ({
    gameName: game.gameName,
    playerIds: game.players.map((player) => player.playerId),
  }));
}

describe('seat-lifecycle: disconnects and the grace window', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a disconnecting creator hands the pending game to the next player; the last one leaving deletes it', () => {
    const fixture = createPendingGameLobby();
    const bob = fixture.join('bob');
    fixture.handlers.onJoinGame(bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
    fixture.lobby.handleDisconnect(fixture.alice);
    expect(fixture.lobby.listGames()[0]?.creatorId).toBe('bob');
    fixture.lobby.handleDisconnect(bob);
    expect(fixture.lobby.listGames()).toHaveLength(0);
  });

  it('a reconnect within the grace window reattaches and resends game_state', () => {
    vi.useFakeTimers();
    const fixture = createActiveGameLobby();
    fixture.lobby.handleDisconnect(fixture.alice);
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS - 1);
    fixture.lobby.handleConnect(fixture.alice, fixture.connections);
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS);
    const room = fixture.lobby.getActiveRoom(fixture.gameId);
    expect(room?.disconnectedPlayers.has('alice')).toBe(false);
    expect(fixture.sent['alice']).toContainEqual(
      expect.objectContaining({ type: SERVER_MESSAGE_TYPE.gameState, balance: DEFAULT_BALANCE }),
    );
    room?.stop();
  });

  it('a disconnect that outlives the grace window removes the player and tears down an empty room', () => {
    vi.useFakeTimers();
    const fixture = createActiveGameLobby();
    fixture.lobby.handleDisconnect(fixture.alice);
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS + 1);
    expect(fixture.lobby.getActiveRoom(fixture.gameId)).toBeUndefined();
  });

  it('at the end of a grace window tells the player left behind, with a lobby_update listing only them', () => {
    vi.useFakeTimers();
    const fixture = createTwoPlayerGameLobby();
    fixture.lobby.handleDisconnect(fixture.bob);
    expect(fixture.sent['alice']).toContainEqual({ type: SERVER_MESSAGE_TYPE.playerDisconnected, playerId: 'bob' });
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS + 1);
    expect(fixture.room.allPlayerIds).toEqual(['alice']);
    expect(fixture.room.disconnectedPlayers.has('bob')).toBe(false);
    expect(fixture.sent['alice']!.at(-1)).toMatchObject({
      type: SERVER_MESSAGE_TYPE.lobbyUpdate,
      games: [{ gameId: fixture.gameId, players: [{ playerId: 'alice' }] }],
    });
    fixture.room.stop();
  });

  it('connecting or disconnecting a player who is in no game is a no-op', () => {
    const fixture = createTestLobby();
    const stranger = fixture.join('stranger');
    fixture.lobby.handleConnect(stranger, fixture.connections);
    fixture.lobby.handleDisconnect(stranger);
    expect(fixture.sent['stranger']).toEqual([]);
  });
});

describe('seat-lifecycle: leave_game (#319)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('removes the player from the active room at once and tells everyone', () => {
    const fixture = createTwoPlayerGameLobby();
    const removeSpy = vi.spyOn(fixture.room, 'removePlayer');
    const inputSpy = vi.spyOn(fixture.room, 'submitInput');
    const input = { type: CLIENT_MESSAGE_TYPE.playerInput, payload: createTestGameInput() };
    fixture.handlers.onLeaveGame(fixture.bob, fixture.leave);
    fixture.handlers.onPlayerInput(fixture.bob, input);
    expect(removeSpy).toHaveBeenCalledWith('bob');
    expect(inputSpy).not.toHaveBeenCalled();
    expect(fixture.room.playerConnections.has('bob')).toBe(false);
    expect(fixture.lobby.listGames()[0]?.players.map((player) => player.playerId)).toEqual(['alice']);
    expect(fixture.sent['alice']).toContainEqual({ type: SERVER_MESSAGE_TYPE.playerDisconnected, playerId: 'bob' });
    expect(sentTypesTo(fixture.sent, 'bob').at(-1)).toBe(SERVER_MESSAGE_TYPE.lobbyUpdate);
    fixture.room.stop();
  });

  it('tears down a room its last player leaves', () => {
    const fixture = createActiveGameLobby();
    fixture.handlers.onLeaveGame(fixture.alice, { type: CLIENT_MESSAGE_TYPE.leaveGame, gameId: fixture.gameId });
    expect(fixture.lobby.getActiveRoom(fixture.gameId)).toBeUndefined();
    expect(fixture.lobby.listGames()).toHaveLength(0);
  });

  it('leaves a pending game the way a disconnect does', () => {
    const fixture = createPendingGameLobby();
    const bob = fixture.join('bob');
    fixture.handlers.onJoinGame(bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
    fixture.handlers.onLeaveGame(fixture.alice, { type: CLIENT_MESSAGE_TYPE.leaveGame, gameId: fixture.gameId });
    expect(fixture.lobby.listGames()[0]).toMatchObject({ creatorId: 'bob', players: [{ playerId: 'bob' }] });
  });

  it('is a no-op for a room the player is not seated in and for an unknown room', () => {
    const fixture = createTwoPlayerGameLobby();
    const stranger = fixture.join('stranger');
    const sentToBob = fixture.sent['bob']!.length;
    fixture.handlers.onLeaveGame(stranger, { type: CLIENT_MESSAGE_TYPE.leaveGame, gameId: fixture.gameId });
    fixture.handlers.onLeaveGame(fixture.bob, { type: CLIENT_MESSAGE_TYPE.leaveGame, gameId: 'nope' });
    expect(fixture.room.allPlayerIds).toEqual(['alice', 'bob']);
    expect(fixture.sent['stranger']).toEqual([]);
    expect(fixture.sent['bob']).toHaveLength(sentToBob);
    fixture.room.stop();
  });

  it('lets the player join the room it left again, as a connected late joiner', () => {
    const fixture = createTwoPlayerGameLobby();
    fixture.handlers.onLeaveGame(fixture.bob, fixture.leave);
    fixture.handlers.onJoinGame(fixture.bob, fixture.rejoin);
    expect(fixture.room.allPlayerIds).toEqual(['alice', 'bob']);
    expect(fixture.room.disconnectedPlayers.has('bob')).toBe(false);
    fixture.room.stop();
  });

  it('holds no seat afterwards: a later close starts no grace window', () => {
    vi.useFakeTimers();
    const fixture = createTwoPlayerGameLobby();
    fixture.handlers.onLeaveGame(fixture.bob, fixture.leave);
    fixture.lobby.handleDisconnect(fixture.bob);
    expect(playerDisconnectedCount(fixture.sent, 'alice')).toBe(1);
    fixture.room.stop();
  });

  // Defensive: over the wire `handleConnect` cancels a drop's timer before any frame arrives.
  it('cancels a pending grace timer, so it cannot remove the player after a rejoin', () => {
    vi.useFakeTimers();
    const fixture = createTwoPlayerGameLobby();
    fixture.lobby.handleDisconnect(fixture.bob);
    fixture.handlers.onLeaveGame(fixture.bob, fixture.leave);
    fixture.handlers.onJoinGame(fixture.bob, fixture.rejoin);
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS + 1);
    expect(fixture.room.allPlayerIds).toEqual(['alice', 'bob']);
    fixture.room.stop();
  });
});

describe('seat-lifecycle: join_game or create_game while seated in another room (#334)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('join_game into another active room leaves the old one first: no ghost seat, and everyone is told', () => {
    const fixture = createTwoPlayerGameLobby();
    const carol = fixture.join('carol');
    const otherGameId = hostTestGame(fixture, carol, { gameName: 'other', isStarted: true });
    const otherRoom = fixture.lobby.getActiveRoom(otherGameId)!;
    const removeSpy = vi.spyOn(fixture.room, 'removePlayer');
    fixture.handlers.onJoinGame(fixture.bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: otherGameId });
    expect(removeSpy).toHaveBeenCalledWith('bob');
    expect(fixture.room.playerConnections.has('bob')).toBe(false);
    expect(fixture.sent['alice']).toContainEqual({ type: SERVER_MESSAGE_TYPE.playerDisconnected, playerId: 'bob' });
    expect(seatsOf(fixture)).toEqual([
      { gameName: 'G', playerIds: ['alice'] },
      { gameName: 'other', playerIds: ['carol', 'bob'] },
    ]);
    fixture.room.stop();
    otherRoom.stop();
  });

  it('tears down the old active room when its only player joins another', () => {
    const fixture = createActiveGameLobby();
    const room = fixture.lobby.getActiveRoom(fixture.gameId)!;
    const stopSpy = vi.spyOn(room, 'stop');
    const bob = fixture.join('bob');
    const otherGameId = hostTestGame(fixture, bob, { gameName: 'other' });
    fixture.handlers.onJoinGame(fixture.alice, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: otherGameId });
    expect(stopSpy).toHaveBeenCalled();
    expect(fixture.lobby.getActiveRoom(fixture.gameId)).toBeUndefined();
    expect(seatsOf(fixture)).toEqual([{ gameName: 'other', playerIds: ['bob', 'alice'] }]);
  });

  it('join_game into another pending game frees the old pending seat and its maxPlayers place', () => {
    const fixture = createPendingGameLobby(2);
    const [bob, carol, dave] = ['bob', 'carol', 'dave'].map((playerId) => fixture.join(playerId));
    fixture.handlers.onJoinGame(bob!, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
    const otherGameId = hostTestGame(fixture, carol!, { gameName: 'other' });
    fixture.handlers.onJoinGame(bob!, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: otherGameId });
    fixture.handlers.onJoinGame(dave!, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
    expect(seatsOf(fixture)).toEqual([
      { gameName: 'G', playerIds: ['alice', 'dave'] },
      { gameName: 'other', playerIds: ['carol', 'bob'] },
    ]);
    expect(sentTypesTo(fixture.sent, 'dave')).not.toContain(SERVER_MESSAGE_TYPE.error);
  });

  it('create_game leaves an active seat, and hands a pending game the creator leaves to the next player', () => {
    const fixture = createTwoPlayerGameLobby();
    hostTestGame(fixture, fixture.bob, { gameName: 'bobs' });
    expect(fixture.sent['alice']).toContainEqual({ type: SERVER_MESSAGE_TYPE.playerDisconnected, playerId: 'bob' });
    const carol = fixture.join('carol');
    fixture.handlers.onJoinGame(carol, {
      type: CLIENT_MESSAGE_TYPE.joinGame,
      gameId: fixture.lobby.listGames()[0]!.gameId,
    });
    hostTestGame(fixture, fixture.bob, { gameName: 'bobs again' });
    expect(fixture.lobby.listGames()).toMatchObject([
      { gameName: 'bobs', creatorId: 'carol', players: [{ playerId: 'carol' }] },
      { gameName: 'bobs again', creatorId: 'bob', players: [{ playerId: 'bob' }] },
      { gameName: 'G', players: [{ playerId: 'alice' }] },
    ]);
    fixture.room.stop();
  });

  it('a refused join keeps the seat: an unknown game and a full game', () => {
    const fixture = createTwoPlayerGameLobby();
    const carol = fixture.join('carol');
    const fullGameId = hostTestGame(fixture, carol, { gameName: 'full', maxPlayers: 1 });
    fixture.handlers.onJoinGame(fixture.bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: 'nope' });
    fixture.handlers.onJoinGame(fixture.bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fullGameId });
    expect(fixture.room.allPlayerIds).toEqual(['alice', 'bob']);
    expect(playerDisconnectedCount(fixture.sent, 'alice')).toBe(0);
    fixture.room.stop();
  });

  it('join_game into the pending game already held keeps the one seat', () => {
    const fixture = createPendingGameLobby();
    fixture.handlers.onJoinGame(fixture.alice, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
    expect(seatsOf(fixture)).toEqual([{ gameName: 'G', playerIds: ['alice'] }]);
    expect(fixture.lobby.listGames()[0]?.creatorId).toBe('alice');
  });

  it('cancels the old room grace timer, so it cannot unseat the player from the new room', () => {
    vi.useFakeTimers();
    const fixture = createTwoPlayerGameLobby();
    const carol = fixture.join('carol');
    const otherGameId = hostTestGame(fixture, carol, { gameName: 'other', isStarted: true });
    const otherRoom = fixture.lobby.getActiveRoom(otherGameId)!;
    fixture.lobby.handleDisconnect(fixture.bob);
    fixture.handlers.onJoinGame(fixture.bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: otherGameId });
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS + 1);
    const inputSpy = vi.spyOn(otherRoom, 'submitInput');
    const input = createTestGameInput();
    fixture.handlers.onPlayerInput(fixture.bob, { type: CLIENT_MESSAGE_TYPE.playerInput, payload: input });
    expect(inputSpy).toHaveBeenCalledWith('bob', input);
    expect(otherRoom.allPlayerIds).toEqual(['carol', 'bob']);
    fixture.room.stop();
    otherRoom.stop();
  });
});
