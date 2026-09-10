import { describe, it, expect, vi } from 'vitest';
import { CLIENT_MESSAGE_TYPE } from '@evolution/shared';
import { createMessageRouter, type MessageHandlers } from './message-router.js';
import { createTestConnection, type SentLog } from '../testing/builders.js';

const PLAYER_ID = 'p1';

function stubHandlers(): MessageHandlers {
  return {
    onJoinLobby: vi.fn(),
    onUpdatePlayerInfo: vi.fn(),
    onCreateGame: vi.fn(),
    onJoinGame: vi.fn(),
    onStartGame: vi.fn(),
    onDeleteGame: vi.fn(),
    onPlayerInput: vi.fn(),
    onClientPerformance: vi.fn(),
  };
}

function setUp() {
  const handlers = stubHandlers();
  const route = createMessageRouter(handlers);
  const sent: SentLog = {};
  const connection = createTestConnection({ playerId: PLAYER_ID, sent });
  return { handlers, route, connection, sent: sent[PLAYER_ID] ?? [] };
}

/** One minimal valid frame per verb the schema accepts, paired with the handler it must reach. */
const FRAME_FOR_VERB: Record<keyof MessageHandlers, Record<string, unknown>> = {
  onJoinLobby: { type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: 'Bob', avatarIndex: 2 },
  onUpdatePlayerInfo: { type: CLIENT_MESSAGE_TYPE.updatePlayerInfo, playerName: 'Bobby', avatarIndex: 3 },
  onCreateGame: { type: CLIENT_MESSAGE_TYPE.createGame, gameName: 'Dish', config: { maxPlayers: 4 } },
  onJoinGame: { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: 'game-1' },
  onStartGame: { type: CLIENT_MESSAGE_TYPE.startGame, gameId: 'game-1' },
  onDeleteGame: { type: CLIENT_MESSAGE_TYPE.deleteGame, gameId: 'game-1' },
  onPlayerInput: { type: CLIENT_MESSAGE_TYPE.playerInput, payload: { anything: [1, 2, 3] } },
  onClientPerformance: {
    type: CLIENT_MESSAGE_TYPE.clientPerformance,
    report: { fps: 60, frameTimeAvgMs: 16, frameTimeP95Ms: 20, frameTimePeakMs: 33, heapMb: null },
  },
};

describe('message-router', () => {
  it('rejects invalid JSON with an error message', () => {
    const { route, connection, sent } = setUp();
    route(connection, 'not json');
    expect(sent).toEqual([{ type: 'error', message: 'Invalid JSON' }]);
  });

  it('rejects schema-invalid messages', () => {
    const { handlers, route, connection, sent } = setUp();
    route(connection, JSON.stringify({ type: CLIENT_MESSAGE_TYPE.joinLobby }));
    expect(sent[0]).toMatchObject({ type: 'error' });
    expect(handlers.onJoinLobby).not.toHaveBeenCalled();
  });

  it('covers every verb the schema accepts', () => {
    const verbs = Object.values(FRAME_FOR_VERB).map((frame) => frame['type']);
    expect(verbs.sort()).toEqual(Object.values(CLIENT_MESSAGE_TYPE).sort());
  });

  it.each(Object.entries(FRAME_FOR_VERB))('routes %s to exactly its handler', (handlerName, frame) => {
    const { handlers, route, connection, sent } = setUp();
    route(connection, JSON.stringify(frame));
    expect(sent).toEqual([]);
    for (const [name, handler] of Object.entries(handlers)) {
      if (name === handlerName) {
        expect(handler).toHaveBeenCalledWith(connection, expect.objectContaining(frame));
      } else {
        expect(handler).not.toHaveBeenCalled();
      }
    }
  });
});
