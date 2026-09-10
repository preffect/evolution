import { describe, it, expect, vi } from 'vitest';
import { createMessageRouter, type MessageHandlers } from './message-router.js';
import type { Connection } from './connection.js';

function makeConnection(): { connection: Connection; sent: unknown[] } {
  const sent: unknown[] = [];
  const connection = {
    playerId: 'p1',
    playerName: 'Alice',
    avatarIndex: 0,
    socket: {
      readyState: 1,
      send: (data: string) => sent.push(JSON.parse(data)),
      close: () => {},
      on: () => {},
    } as unknown as Connection['socket'],
  } satisfies Connection;
  return { connection, sent };
}

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

describe('message-router', () => {
  it('rejects invalid JSON with an error message', () => {
    const handlers = stubHandlers();
    const route = createMessageRouter(handlers);
    const { connection, sent } = makeConnection();
    route(connection, 'not json');
    expect(sent).toEqual([{ type: 'error', message: 'Invalid JSON' }]);
  });

  it('rejects schema-invalid messages', () => {
    const handlers = stubHandlers();
    const route = createMessageRouter(handlers);
    const { connection, sent } = makeConnection();
    route(connection, JSON.stringify({ type: 'join_lobby' }));
    expect(sent[0]).toMatchObject({ type: 'error' });
    expect(handlers.onJoinLobby).not.toHaveBeenCalled();
  });

  it('routes a valid join_lobby to the handler', () => {
    const handlers = stubHandlers();
    const route = createMessageRouter(handlers);
    const { connection } = makeConnection();
    route(connection, JSON.stringify({ type: 'join_lobby', playerName: 'Bob', avatarIndex: 2 }));
    expect(handlers.onJoinLobby).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ type: 'join_lobby', playerName: 'Bob', avatarIndex: 2 }),
    );
  });

  it('routes player_input with an opaque payload (client-trust)', () => {
    const handlers = stubHandlers();
    const route = createMessageRouter(handlers);
    const { connection } = makeConnection();
    const payload = { anything: [1, 2, 3] };
    route(connection, JSON.stringify({ type: 'player_input', payload }));
    expect(handlers.onPlayerInput).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ type: 'player_input', payload }),
    );
  });
});
