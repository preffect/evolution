import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BYTES_PER_MEBIBYTE } from '@evolution/shared';
import type { DebugContext } from '../debug-context.js';
import type { GameRoom } from '../../lobby/game-room.js';
import { errorResult, jsonResult } from '../tool-result.js';

function toMebibytes(bytes: number): number {
  return Math.round(bytes / BYTES_PER_MEBIBYTE);
}

function registerServerPerformanceTool(mcp: McpServer, context: DebugContext): void {
  mcp.tool(
    'debug_get_performance',
    'Get server-wide performance metrics (uptime, memory, room/connection counts)',
    () => {
      const memory = process.memoryUsage();
      return jsonResult({
        uptimeSeconds: Math.round(process.uptime()),
        memoryMb: {
          rss: toMebibytes(memory.rss),
          heapUsed: toMebibytes(memory.heapUsed),
          heapTotal: toMebibytes(memory.heapTotal),
        },
        activeRooms: context.lobbyManager.listActiveRooms().size,
        pendingGames: context.lobbyManager.listPendingGames().size,
        totalConnections: context.connections.size,
      });
    },
  );
}

/** The rooms a request names: one when `gameId` is given (empty if unknown), otherwise all. */
function selectRooms(context: DebugContext, gameId: string | undefined): (readonly [string, GameRoom])[] {
  if (gameId === undefined) return Array.from(context.lobbyManager.listActiveRooms().entries());
  const room = context.lobbyManager.getActiveRoom(gameId);
  return room ? [[gameId, room] as const] : [];
}

function registerRoomPerformanceTool(mcp: McpServer, context: DebugContext): void {
  mcp.tool(
    'debug_get_room_performance',
    'Get per-room tick timings, snapshot byte sizes, broadcast fan-out, and merged client perf/heartbeat reports. Omit gameId for all active rooms.',
    { gameId: z.string().optional().describe('Optional game ID. If omitted, returns all active rooms.') },
    (input) => {
      const rooms = selectRooms(context, input.gameId);
      if (rooms.length === 0) {
        return input.gameId ? errorResult(`Room "${input.gameId}" not found`) : jsonResult('No active rooms');
      }
      const stats = rooms.map(([gameId, room]) => ({
        gameId,
        playerCount: room.playerConnections.size,
        ...room.performanceTracker.getStats(),
      }));
      return jsonResult(stats);
    },
  );
}

/** Generic server + per-room performance/heartbeat tools. */
export function registerPerformanceTools(mcp: McpServer, context: DebugContext): void {
  registerServerPerformanceTool(mcp, context);
  registerRoomPerformanceTool(mcp, context);
}
