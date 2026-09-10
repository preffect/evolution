import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLIENT_MESSAGE_TYPE,
  DEFAULT_BALANCE,
  DISCONNECT_GRACE_MS,
  SERVER_MESSAGE_TYPE,
  createTestGameInput,
  createTestSessionConfig,
} from '@evolution/shared';
import { createTestLobby } from '../testing/builders.js';

type Sent = { type: string }[];

function typesSentTo(sent: Record<string, unknown[]>, playerId: string): string[] {
  return (sent[playerId] as Sent).map((message) => message.type);
}

/** A lobby where alice created a game; returns its id. */
function lobbyWithPendingGame(maxPlayers = 4) {
  const fixture = createTestLobby();
  const alice = fixture.join('alice', 'Alice');
  fixture.handlers.onJoinLobby(alice, { type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: 'Alice', avatarIndex: 0 });
  fixture.handlers.onCreateGame(alice, {
    type: CLIENT_MESSAGE_TYPE.createGame,
    gameName: 'G',
    config: createTestSessionConfig({ maxPlayers }),
  });
  const gameId = fixture.lobby.listGames()[0]!.gameId;
  return { ...fixture, alice, gameId };
}

/** A lobby where alice created and started a game. */
function lobbyWithActiveGame() {
  const fixture = lobbyWithPendingGame();
  fixture.handlers.onStartGame(fixture.alice, { type: CLIENT_MESSAGE_TYPE.startGame, gameId: fixture.gameId });
  return fixture;
}

describe('lobby-manager: pending games', () => {
  it('create_game then join_game tracks players and broadcasts lobby_update', () => {
    const fixture = lobbyWithPendingGame();
    const bob = fixture.join('bob', 'Bob');
    fixture.handlers.onJoinGame(bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
    expect(fixture.lobby.listGames()[0]?.players.map((player) => player.playerName)).toEqual(['Alice', 'Bob']);
    expect(typesSentTo(fixture.sent, 'bob')).toContain(SERVER_MESSAGE_TYPE.lobbyUpdate);
  });

  it('rejects joining an unknown game and a full game with an error', () => {
    const fixture = lobbyWithPendingGame(1);
    const bob = fixture.join('bob');
    fixture.handlers.onJoinGame(bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: 'nope' });
    fixture.handlers.onJoinGame(bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
    expect(fixture.sent['bob']).toEqual([
      { type: SERVER_MESSAGE_TYPE.error, message: 'Game not found' },
      { type: SERVER_MESSAGE_TYPE.error, message: 'Game is full' },
    ]);
  });

  it('update_player_info renames the player inside the pending game', () => {
    const fixture = lobbyWithPendingGame();
    fixture.handlers.onUpdatePlayerInfo(fixture.alice, {
      type: CLIENT_MESSAGE_TYPE.updatePlayerInfo,
      playerName: 'Alicia',
      avatarIndex: 3,
    });
    expect(fixture.lobby.listGames()[0]?.players[0]).toMatchObject({ playerName: 'Alicia', avatarIndex: 3 });
  });

  it('delete_game by the creator removes a pending game; anyone else is refused', () => {
    const fixture = lobbyWithPendingGame();
    const bob = fixture.join('bob');
    fixture.handlers.onDeleteGame(bob, { type: CLIENT_MESSAGE_TYPE.deleteGame, gameId: fixture.gameId });
    expect(fixture.lobby.listGames()).toHaveLength(1);
    expect(typesSentTo(fixture.sent, 'bob')).toEqual([SERVER_MESSAGE_TYPE.error]);
    fixture.handlers.onDeleteGame(fixture.alice, { type: CLIENT_MESSAGE_TYPE.deleteGame, gameId: fixture.gameId });
    expect(fixture.lobby.listGames()).toHaveLength(0);
  });

  it('a disconnecting creator hands the game to the next player; the last one leaving deletes it', () => {
    const fixture = lobbyWithPendingGame();
    const bob = fixture.join('bob');
    fixture.handlers.onJoinGame(bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
    fixture.lobby.handleDisconnect(fixture.alice);
    expect(fixture.lobby.listGames()[0]?.creatorId).toBe('bob');
    fixture.lobby.handleDisconnect(bob);
    expect(fixture.lobby.listGames()).toHaveLength(0);
  });
});

describe('lobby-manager: starting and running games', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('start_game moves a pending game to active and notifies players', () => {
    const fixture = lobbyWithActiveGame();
    expect(fixture.lobby.getActiveRoom(fixture.gameId)).toBeDefined();
    expect(fixture.lobby.listGames()[0]).toMatchObject({ isStarted: true, players: [{ playerName: 'Alice' }] });
    expect(fixture.sent['alice']).toContainEqual(expect.objectContaining({ type: 'game_started', isHost: true }));
    fixture.lobby.getActiveRoom(fixture.gameId)?.stop();
  });

  it('only the creator may start the game; an unknown game is an error', () => {
    const fixture = lobbyWithPendingGame();
    const bob = fixture.join('bob');
    fixture.handlers.onJoinGame(bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
    fixture.handlers.onStartGame(bob, { type: CLIENT_MESSAGE_TYPE.startGame, gameId: fixture.gameId });
    fixture.handlers.onStartGame(fixture.alice, { type: CLIENT_MESSAGE_TYPE.startGame, gameId: 'nope' });
    expect(fixture.lobby.getActiveRoom(fixture.gameId)).toBeUndefined();
    expect(typesSentTo(fixture.sent, 'bob')).toContain(SERVER_MESSAGE_TYPE.error);
    expect(fixture.sent['alice']).toContainEqual({ type: SERVER_MESSAGE_TYPE.error, message: 'Game not found' });
  });

  it('routes player_input and client_performance to the active room', () => {
    const fixture = lobbyWithActiveGame();
    const room = fixture.lobby.getActiveRoom(fixture.gameId)!;
    const inputSpy = vi.spyOn(room, 'submitInput');
    const performanceSpy = vi.spyOn(room, 'recordClientPerformance');
    const report = { fps: 60, frameTimeAvgMs: 1, frameTimeP95Ms: 2, frameTimePeakMs: 3, heapMb: null };
    const input = createTestGameInput();
    fixture.handlers.onPlayerInput(fixture.alice, { type: CLIENT_MESSAGE_TYPE.playerInput, payload: input });
    fixture.handlers.onClientPerformance(fixture.alice, { type: CLIENT_MESSAGE_TYPE.clientPerformance, report });
    expect(inputSpy).toHaveBeenCalledWith('alice', input);
    expect(performanceSpy).toHaveBeenCalledWith('alice', report);
    room.stop();
  });

  it('joining an active game is a late join that receives the full game state with its balance', () => {
    const fixture = lobbyWithActiveGame();
    const bob = fixture.join('bob', 'Bob');
    fixture.handlers.onJoinGame(bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
    expect(fixture.sent['bob']).toContainEqual(
      expect.objectContaining({ type: SERVER_MESSAGE_TYPE.gameState, balance: DEFAULT_BALANCE }),
    );
    expect(fixture.lobby.getActiveRoom(fixture.gameId)?.allPlayerIds).toEqual(['alice', 'bob']);
    fixture.lobby.getActiveRoom(fixture.gameId)?.stop();
  });

  it('delete_game on an active room tears it down for the creator only', () => {
    const fixture = lobbyWithActiveGame();
    const bob = fixture.join('bob');
    fixture.handlers.onDeleteGame(bob, { type: CLIENT_MESSAGE_TYPE.deleteGame, gameId: fixture.gameId });
    expect(fixture.lobby.getActiveRoom(fixture.gameId)).toBeDefined();
    fixture.handlers.onDeleteGame(fixture.alice, { type: CLIENT_MESSAGE_TYPE.deleteGame, gameId: fixture.gameId });
    expect(fixture.lobby.getActiveRoom(fixture.gameId)).toBeUndefined();
    expect(fixture.lobby.listGames()).toHaveLength(0);
  });

  it('a reconnect within the grace window reattaches and resends game_state', () => {
    vi.useFakeTimers();
    const fixture = lobbyWithActiveGame();
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
    const fixture = lobbyWithActiveGame();
    fixture.lobby.handleDisconnect(fixture.alice);
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS + 1);
    expect(fixture.lobby.getActiveRoom(fixture.gameId)).toBeUndefined();
  });

  it('connecting or disconnecting a player who is in no game is a no-op', () => {
    const fixture = createTestLobby();
    const stranger = fixture.join('stranger');
    fixture.lobby.handleConnect(stranger, fixture.connections);
    fixture.lobby.handleDisconnect(stranger);
    expect(fixture.sent['stranger']).toEqual([]);
  });
});
