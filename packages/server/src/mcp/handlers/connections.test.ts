import { describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { registerConnectionTools } from './connections.js';
import {
  createTestDebugContext,
  createTestConnection,
  createToolCapture,
  parseToolJson,
} from '../../testing/builders.js';

describe('debug_get_connections', () => {
  it('lists every registered connection with its lobby presence and socket state', async () => {
    const context = createTestDebugContext();
    const connections = context.connections as Map<string, ReturnType<typeof createTestConnection>>;
    connections.set('p1', createTestConnection({ playerId: 'p1', playerName: 'Alice', avatarIndex: 2 }));
    const capture = createToolCapture();
    registerConnectionTools(capture.mcp, context);
    expect(parseToolJson(await capture.call('debug_get_connections'))).toEqual([
      { playerId: 'p1', playerName: 'Alice', avatarIndex: 2, readyState: WebSocket.OPEN },
    ]);
  });
});
