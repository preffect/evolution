import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DebugContext } from '../debug-context.js';
import { gameNotFoundResult, jsonResult } from '../tool-result.js';

function registerListGamesTool(mcp: McpServer, context: DebugContext): void {
  mcp.tool('debug_list_games', 'List all pending (lobby) and active games with player counts', () => {
    const pending = Array.from(context.lobbyManager.listPendingGames(), ([gameId, game]) => ({
      gameId,
      status: 'pending' as const,
      gameName: game.gameName,
      creatorId: game.creatorId,
      playerCount: game.players.size,
      maxPlayers: game.config.maxPlayers,
    }));
    const active = Array.from(context.lobbyManager.listActiveRooms(), ([gameId, room]) => ({
      gameId,
      status: 'active' as const,
      gameName: room.gameName,
      creatorId: room.creatorId,
      playerCount: room.playerConnections.size,
      maxPlayers: room.sessionConfig.maxPlayers,
    }));
    return jsonResult([...pending, ...active]);
  });
}

function registerGetRoomTool(mcp: McpServer, context: DebugContext): void {
  mcp.tool(
    'debug_get_room',
    'Get room membership metadata for an active game (connected, disconnected, and all player ids)',
    { gameId: z.string().describe('The game ID to inspect') },
    (input) => {
      const room = context.lobbyManager.getActiveRoom(input.gameId);
      if (!room) return gameNotFoundResult(input.gameId);
      return jsonResult({
        gameId: input.gameId,
        gameName: room.gameName,
        creatorId: room.creatorId,
        maxPlayers: room.sessionConfig.maxPlayers,
        connected: Array.from(room.playerConnections.keys()),
        disconnected: Array.from(room.disconnectedPlayers),
        allPlayerIds: room.allPlayerIds,
      });
    },
  );
}

/** Generic, game-agnostic room/lobby visibility tools. */
export function registerRoomTools(mcp: McpServer, context: DebugContext): void {
  registerListGamesTool(mcp, context);
  registerGetRoomTool(mcp, context);
}
