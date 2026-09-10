import { describe, expect, it } from 'vitest';
import { CLIENT_MESSAGE_TYPE } from '@evolution/shared';
import { registerRoomTools } from './rooms.js';
import { createTestLobby, createToolCapture, parseToolJson } from '../../testing/builders.js';

function lobbyWithPendingAndActive() {
  const fixture = createTestLobby();
  const alice = fixture.join('alice');
  const bob = fixture.join('bob');
  fixture.handlers.onCreateGame(alice, {
    type: CLIENT_MESSAGE_TYPE.createGame,
    gameName: 'A',
    config: { maxPlayers: 2 },
  });
  fixture.handlers.onCreateGame(bob, {
    type: CLIENT_MESSAGE_TYPE.createGame,
    gameName: 'B',
    config: { maxPlayers: 3 },
  });
  const [aliceGame] = fixture.lobby.listGames();
  fixture.handlers.onStartGame(alice, { type: CLIENT_MESSAGE_TYPE.startGame, gameId: aliceGame!.gameId });
  const capture = createToolCapture();
  registerRoomTools(capture.mcp, { lobbyManager: fixture.lobby, connections: fixture.connections });
  return { ...fixture, ...capture, activeGameId: aliceGame!.gameId };
}

describe('debug_list_games', () => {
  it('lists pending games before active ones with their player counts', async () => {
    const fixture = lobbyWithPendingAndActive();
    const games = parseToolJson(await fixture.call('debug_list_games')) as { status: string; gameName: string }[];
    expect(games.map((game) => [game.status, game.gameName])).toEqual([
      ['pending', 'B'],
      ['active', 'A'],
    ]);
    fixture.lobby.getActiveRoom(fixture.activeGameId)?.stop();
  });
});

describe('debug_get_room', () => {
  it('returns the membership of an active room', async () => {
    const fixture = lobbyWithPendingAndActive();
    const room = parseToolJson(await fixture.call('debug_get_room', { gameId: fixture.activeGameId }));
    expect(room).toMatchObject({ gameName: 'A', creatorId: 'alice', connected: ['alice'], allPlayerIds: ['alice'] });
    fixture.lobby.getActiveRoom(fixture.activeGameId)?.stop();
  });

  it('is an error for an unknown or pending game', async () => {
    const fixture = lobbyWithPendingAndActive();
    expect((await fixture.call('debug_get_room', { gameId: 'nope' })).isError).toBe(true);
    fixture.lobby.getActiveRoom(fixture.activeGameId)?.stop();
  });
});
