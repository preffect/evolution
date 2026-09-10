import { describe, expect, it } from 'vitest';
import { CLIENT_MESSAGE_TYPE } from '@evolution/shared';
import { registerGameStateTools } from './game-state.js';
import {
  createDebugCapableGameModule,
  createTestLobby,
  createToolCapture,
  parseToolJson,
  type TestLobbyOptions,
} from '../../testing/builders.js';

function activeRoomFixture(getRoomGameState?: (gameId: string) => unknown, options: TestLobbyOptions = {}) {
  const fixture = createTestLobby(options);
  const alice = fixture.join('alice');
  fixture.handlers.onCreateGame(alice, {
    type: CLIENT_MESSAGE_TYPE.createGame,
    gameName: 'A',
    config: { maxPlayers: 2 },
  });
  const gameId = fixture.lobby.listGames()[0]!.gameId;
  fixture.handlers.onStartGame(alice, { type: CLIENT_MESSAGE_TYPE.startGame, gameId });
  const capture = createToolCapture();
  registerGameStateTools(capture.mcp, {
    lobbyManager: fixture.lobby,
    connections: fixture.connections,
    getRoomGameState,
  });
  const stop = () => fixture.lobby.getActiveRoom(gameId)?.stop();
  return { ...capture, gameId, stop };
}

describe('debug_get_game_state', () => {
  it('falls back to the opaque snapshot plus a note when no inspector is wired', async () => {
    const fixture = activeRoomFixture();
    const blob = parseToolJson(await fixture.call('debug_get_game_state', { gameId: fixture.gameId }));
    expect(blob).toMatchObject({ note: expect.stringContaining('getRoomGameState'), snapshot: { players: [] } });
    fixture.stop();
  });

  it('returns the wired inspector output when the init step provides one', async () => {
    const fixture = activeRoomFixture((gameId) => ({ gameId, cells: 3 }));
    const blob = parseToolJson(await fixture.call('debug_get_game_state', { gameId: fixture.gameId }));
    expect(blob).toEqual({ gameId: fixture.gameId, cells: 3 });
    fixture.stop();
  });

  it('prefers the full state of a debug-capable module over the wired inspector', async () => {
    const gameFactory = () => createDebugCapableGameModule({ serializeFullState: () => ({ cells: [1, 2] }) });
    const fixture = activeRoomFixture(() => ({ summary: true }), { gameFactory });
    const blob = parseToolJson(await fixture.call('debug_get_game_state', { gameId: fixture.gameId }));
    expect(blob).toEqual({ cells: [1, 2] });
    fixture.stop();
  });

  it('is an error for an unknown game', async () => {
    const fixture = activeRoomFixture();
    expect((await fixture.call('debug_get_game_state', { gameId: 'nope' })).isError).toBe(true);
    fixture.stop();
  });
});
