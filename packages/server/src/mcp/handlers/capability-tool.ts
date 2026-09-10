// The one shared room lookup behind every game-specific debug tool (docs/ARCHITECTURE.md §8,
// §10). A tool declares the debug capability it needs; this resolves the room and its handle,
// answers "not supported" when the module lacks the capability, and converts a refused request
// into an `isError` result (docs/CODE-STANDARDS.md §9).

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ShapeOutput } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { z } from 'zod';
import type { GameRoom } from '../../lobby/game-room.js';
import { DebugRequestError } from '../../game/debug/debug-request-error.js';
import { hasDebugCapability, type DebugCapability, type HandleWith } from '../../game/debug/simulation-debug-handle.js';
import type { DebugContext } from '../debug-context.js';
import { errorResult, gameNotFoundResult, jsonResult, type TextToolResult } from '../tool-result.js';

/** Every game-specific tool names its room the same way. */
export const GAME_ID_ARGUMENT = z.string().describe('The game ID');
export const PLAYER_ID_ARGUMENT = z.string().describe('The player ID');

type RoomLookup = { room: GameRoom; result?: undefined } | { room?: undefined; result: TextToolResult };

export function requireRoom(context: DebugContext, gameId: string): RoomLookup {
  const room = context.lobbyManager.getActiveRoom(gameId);
  return room ? { room } : { result: gameNotFoundResult(gameId) };
}

function notSupportedResult(toolName: string, capability: DebugCapability): TextToolResult {
  return errorResult(
    `${toolName} is not supported by this game module (it offers no "${capability}" debug capability)`,
  );
}

/** Runs a debug request; a `DebugRequestError` becomes an error result, anything else propagates. */
export function runDebugRequest(run: () => unknown): TextToolResult {
  try {
    return jsonResult(run());
  } catch (error) {
    if (error instanceof DebugRequestError) return errorResult(error.message);
    throw error;
  }
}

type RoomArguments = z.ZodRawShape & { gameId: typeof GAME_ID_ARGUMENT };

export interface CapabilityToolDefinition<Name extends DebugCapability, Shape extends RoomArguments> {
  readonly name: string;
  readonly description: string;
  readonly capability: Name;
  readonly schema: Shape;
  /** Produces the JSON the tool answers with; throw `DebugRequestError` to refuse. */
  readonly run: (handle: HandleWith<Name>, input: ShapeOutput<Shape>, room: GameRoom) => unknown;
}

/** Registers a tool that needs one debug capability of the room's game module. */
export function registerCapabilityTool<Name extends DebugCapability, Shape extends RoomArguments>(
  mcp: McpServer,
  context: DebugContext,
  definition: CapabilityToolDefinition<Name, Shape>,
): void {
  const schema: z.ZodRawShape = definition.schema;
  mcp.tool(definition.name, definition.description, schema, (input: Record<string, unknown>) => {
    const lookup = requireRoom(context, GAME_ID_ARGUMENT.parse(input.gameId));
    if (!lookup.room) return lookup.result;
    const handle = lookup.room.getDebugHandle();
    if (!handle || !hasDebugCapability(handle, definition.capability)) {
      return notSupportedResult(definition.name, definition.capability);
    }
    // The SDK parsed `input` against `definition.schema` before calling back, so the shape holds.
    return runDebugRequest(() => definition.run(handle, input as ShapeOutput<Shape>, lookup.room));
  });
}
