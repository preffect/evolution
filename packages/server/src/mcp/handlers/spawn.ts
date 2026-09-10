import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DebugContext } from '../debug-context.js';
import { GAME_ID_ARGUMENT, registerCapabilityTool } from './capability-tool.js';

/** `debug_spawn`: place food, a DNA fragment or an NPC at a point through the module's spawner. */
export function registerSpawnTools(mcp: McpServer, context: DebugContext): void {
  registerCapabilityTool(mcp, context, {
    name: 'debug_spawn',
    description: 'Spawn an entity (food / NPC / DNA fragment) at a world-unit point, through the spawner',
    capability: 'spawn',
    schema: {
      gameId: GAME_ID_ARGUMENT,
      kind: z.string().describe('Entity kind id to spawn'),
      x: z.number(),
      y: z.number(),
      params: z.record(z.unknown()).default({}).describe('Kind-specific extras (variant, tags, mass...)'),
    },
    run: (handle, input) => handle.spawn({ kind: input.kind, x: input.x, y: input.y, params: input.params }),
  });
}
