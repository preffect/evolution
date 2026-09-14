import { describe, expect, it, vi } from 'vitest';
import {
  CLIENT_MESSAGE_TYPE,
  DEFAULT_BALANCE,
  SERVER_MESSAGE_TYPE,
  createTestClientPerformanceReport,
  createTestGameInput,
} from '@evolution/shared';
import { createActiveGameLobby, createPendingGameLobby, sentTypesTo } from '../testing/builders.js';

// How a seat is freed (disconnect grace, leave_game, a seat taken elsewhere) is pinned in seat-lifecycle.test.ts.

describe('lobby-manager: pending games', () => {
  it('create_game then join_game tracks players and broadcasts lobby_update', () => {
    const fixture = createPendingGameLobby();
    const bob = fixture.join('bob', 'Bob');
    fixture.handlers.onJoinGame(bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
    expect(fixture.lobby.listGames()[0]?.players.map((player) => player.playerName)).toEqual(['Alice', 'Bob']);
    expect(sentTypesTo(fixture.sent, 'bob')).toContain(SERVER_MESSAGE_TYPE.lobbyUpdate);
  });

  it('rejects joining an unknown game and a full game with an error', () => {
    const fixture = createPendingGameLobby(1);
    const bob = fixture.join('bob');
    fixture.handlers.onJoinGame(bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: 'nope' });
    fixture.handlers.onJoinGame(bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
    expect(fixture.sent['bob']).toEqual([
      { type: SERVER_MESSAGE_TYPE.error, message: 'Game not found' },
      { type: SERVER_MESSAGE_TYPE.error, message: 'Game is full' },
    ]);
  });

  it('update_player_info renames the player inside the pending game', () => {
    const fixture = createPendingGameLobby();
    fixture.handlers.onUpdatePlayerInfo(fixture.alice, {
      type: CLIENT_MESSAGE_TYPE.updatePlayerInfo,
      playerName: 'Alicia',
      avatarIndex: 3,
    });
    expect(fixture.lobby.listGames()[0]?.players[0]).toMatchObject({ playerName: 'Alicia', avatarIndex: 3 });
  });

  it('delete_game by the creator removes a pending game; anyone else is refused', () => {
    const fixture = createPendingGameLobby();
    const bob = fixture.join('bob');
    fixture.handlers.onDeleteGame(bob, { type: CLIENT_MESSAGE_TYPE.deleteGame, gameId: fixture.gameId });
    expect(fixture.lobby.listGames()).toHaveLength(1);
    expect(sentTypesTo(fixture.sent, 'bob')).toEqual([SERVER_MESSAGE_TYPE.error]);
    fixture.handlers.onDeleteGame(fixture.alice, { type: CLIENT_MESSAGE_TYPE.deleteGame, gameId: fixture.gameId });
    expect(fixture.lobby.listGames()).toHaveLength(0);
  });
});

describe('lobby-manager: starting and running games', () => {
  it('start_game moves a pending game to active and notifies players', () => {
    const fixture = createActiveGameLobby();
    expect(fixture.lobby.getActiveRoom(fixture.gameId)).toBeDefined();
    expect(fixture.lobby.listGames()[0]).toMatchObject({ isStarted: true, players: [{ playerName: 'Alice' }] });
    expect(fixture.sent['alice']).toContainEqual(expect.objectContaining({ type: 'game_started', isHost: true }));
    fixture.lobby.getActiveRoom(fixture.gameId)?.stop();
  });

  it('start_game follows game_started with the full game_state every player builds its view from', () => {
    const fixture = createActiveGameLobby();
    const types = sentTypesTo(fixture.sent, 'alice');
    expect(types.indexOf(SERVER_MESSAGE_TYPE.gameState)).toBe(types.indexOf(SERVER_MESSAGE_TYPE.gameStarted) + 1);
    expect(fixture.sent['alice']).toContainEqual(
      expect.objectContaining({ type: SERVER_MESSAGE_TYPE.gameState, playerId: 'alice', balance: DEFAULT_BALANCE }),
    );
    fixture.lobby.getActiveRoom(fixture.gameId)?.stop();
  });

  it('only the creator may start the game; an unknown game is an error', () => {
    const fixture = createPendingGameLobby();
    const bob = fixture.join('bob');
    fixture.handlers.onJoinGame(bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
    fixture.handlers.onStartGame(bob, { type: CLIENT_MESSAGE_TYPE.startGame, gameId: fixture.gameId });
    fixture.handlers.onStartGame(fixture.alice, { type: CLIENT_MESSAGE_TYPE.startGame, gameId: 'nope' });
    expect(fixture.lobby.getActiveRoom(fixture.gameId)).toBeUndefined();
    expect(sentTypesTo(fixture.sent, 'bob')).toContain(SERVER_MESSAGE_TYPE.error);
    expect(fixture.sent['alice']).toContainEqual({ type: SERVER_MESSAGE_TYPE.error, message: 'Game not found' });
  });

  it('routes player_input and client_performance to the active room', () => {
    const fixture = createActiveGameLobby();
    const room = fixture.lobby.getActiveRoom(fixture.gameId)!;
    const inputSpy = vi.spyOn(room, 'submitInput');
    const performanceSpy = vi.spyOn(room, 'recordClientPerformance');
    const report = createTestClientPerformanceReport({ frameTimeAvgMs: 1, frameTimeP95Ms: 2, frameTimePeakMs: 3 });
    const input = createTestGameInput();
    fixture.handlers.onPlayerInput(fixture.alice, { type: CLIENT_MESSAGE_TYPE.playerInput, payload: input });
    fixture.handlers.onClientPerformance(fixture.alice, { type: CLIENT_MESSAGE_TYPE.clientPerformance, report });
    expect(inputSpy).toHaveBeenCalledWith('alice', input);
    expect(performanceSpy).toHaveBeenCalledWith('alice', report);
    room.stop();
  });

  it('joining an active game is a late join that receives the full game state with its balance', () => {
    const fixture = createActiveGameLobby();
    const bob = fixture.join('bob', 'Bob');
    fixture.handlers.onJoinGame(bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
    expect(fixture.sent['bob']).toContainEqual(
      expect.objectContaining({ type: SERVER_MESSAGE_TYPE.gameState, balance: DEFAULT_BALANCE }),
    );
    expect(fixture.lobby.getActiveRoom(fixture.gameId)?.allPlayerIds).toEqual(['alice', 'bob']);
    fixture.lobby.getActiveRoom(fixture.gameId)?.stop();
  });

  it('delete_game on an active room tears it down for the creator only', () => {
    const fixture = createActiveGameLobby();
    const bob = fixture.join('bob');
    fixture.handlers.onDeleteGame(bob, { type: CLIENT_MESSAGE_TYPE.deleteGame, gameId: fixture.gameId });
    expect(fixture.lobby.getActiveRoom(fixture.gameId)).toBeDefined();
    fixture.handlers.onDeleteGame(fixture.alice, { type: CLIENT_MESSAGE_TYPE.deleteGame, gameId: fixture.gameId });
    expect(fixture.lobby.getActiveRoom(fixture.gameId)).toBeUndefined();
    expect(fixture.lobby.listGames()).toHaveLength(0);
  });
});
