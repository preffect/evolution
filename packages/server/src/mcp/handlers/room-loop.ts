import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DEBUG_STEP_MAX_SECONDS, secondsToTicks } from '@evolution/shared';
import type { GameRoom } from '../../lobby/game-room.js';
import type { DebugContext } from '../debug-context.js';
import { jsonResult, type TextToolResult } from '../tool-result.js';
import { GAME_ID_ARGUMENT, requireRoom } from './capability-tool.js';

function loopStateOf(gameId: string, room: GameRoom): { gameId: string; isPaused: boolean; tick: number } {
  return { gameId, isPaused: room.isPaused(), tick: room.getTickCount() };
}

/** Resolves the room, applies `control` to it and answers with the loop state. */
function controlRoom(context: DebugContext, gameId: string, control: (room: GameRoom) => void): TextToolResult {
  const lookup = requireRoom(context, gameId);
  if (!lookup.room) return lookup.result;
  control(lookup.room);
  return jsonResult(loopStateOf(gameId, lookup.room));
}

/** The `_room` tools act on the room loop, not the world (docs/ARCHITECTURE.md §8, §3). */
export function registerRoomLoopTools(mcp: McpServer, context: DebugContext): void {
  mcp.tool(
    'debug_pause_room',
    'Freeze the fixed-step loop of an active game so screenshots and inspections are deterministic',
    { gameId: GAME_ID_ARGUMENT },
    (input) => controlRoom(context, input.gameId, (room) => room.pause()),
  );
  mcp.tool(
    'debug_step_room',
    'Advance a game by exactly N ticks (pausing it first if it was running), broadcasting each tick',
    {
      gameId: GAME_ID_ARGUMENT,
      ticks: z
        .number()
        .int()
        .min(1)
        .max(secondsToTicks(DEBUG_STEP_MAX_SECONDS))
        .default(1)
        .describe('Ticks to advance'),
    },
    (input) => controlRoom(context, input.gameId, (room) => room.step(input.ticks)),
  );
  mcp.tool(
    'debug_resume_room',
    'Unfreeze a paused game; the time that passed while paused is discarded, not caught up',
    { gameId: GAME_ID_ARGUMENT },
    (input) => controlRoom(context, input.gameId, (room) => room.resume()),
  );
}
