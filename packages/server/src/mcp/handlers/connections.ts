import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DebugContext } from '../debug-context.js';
import { jsonResult } from '../tool-result.js';

/** Generic, game-agnostic connection/player visibility tools. */
export function registerConnectionTools(mcp: McpServer, context: DebugContext): void {
  mcp.tool('debug_get_connections', 'List all active WebSocket connections (players currently connected)', () => {
    const connections = Array.from(context.connections.values(), (connection) => ({
      playerId: connection.playerId,
      playerName: connection.playerName,
      avatarIndex: connection.avatarIndex,
      readyState: connection.socket.readyState,
    }));
    return jsonResult(connections);
  });
}
