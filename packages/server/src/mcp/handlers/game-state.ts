import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DebugContext } from '../debug-context.js';
import { gameNotFoundResult, jsonResult } from '../tool-result.js';

/**
 * Per-room game-state dump (docs/ARCHITECTURE.md §8). It returns the template's
 * `context.getRoomGameState(gameId)` inspector when the init step wired one, ELSE the room's
 * full state (`GameRoom.getFullState()`: the module's `serializeFullState()`, the same
 * `{ snapshot, balance }` payload `game_state` sends a joining client). The Evolution module
 * never wires the inspector, so there is one path to its full state.
 */
export function registerGameStateTools(mcp: McpServer, context: DebugContext): void {
  mcp.tool(
    'debug_get_game_state',
    'Get the full game state of an active room: the `game_state` payload (snapshot + balance) a joining client receives',
    { gameId: z.string().describe('The game ID') },
    (input) => {
      const room = context.lobbyManager.getActiveRoom(input.gameId);
      if (!room) return gameNotFoundResult(input.gameId);
      return jsonResult(context.getRoomGameState?.(input.gameId) ?? room.getFullState());
    },
  );
}
