import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DebugContext } from '../debug-context.js';
import { GAME_ID_ARGUMENT, registerCapabilityTool } from './capability-tool.js';

const BOUNDING_BOX_SCHEMA = z
  .object({ minX: z.number(), minY: z.number(), maxX: z.number(), maxY: z.number() })
  .refine((box) => box.minX <= box.maxX && box.minY <= box.maxY, { message: 'bbox min must not exceed max' })
  .describe('World-unit box to restrict the listing to (inclusive bounds)');

/** `debug_get_entities`: cells, food, DNA fragments and bacteria with position, mass and traits. */
export function registerEntityTools(mcp: McpServer, context: DebugContext): void {
  registerCapabilityTool(mcp, context, {
    name: 'debug_get_entities',
    description: 'List the entities of an active game (cells, food, DNA, NPCs) with position, mass and traits',
    capability: 'listEntities',
    schema: {
      gameId: GAME_ID_ARGUMENT,
      kind: z.string().optional().describe('Only entities of this kind id; omit for every kind'),
      bbox: BOUNDING_BOX_SCHEMA.optional(),
    },
    run: (handle, input) => handle.listEntities({ kind: input.kind, bbox: input.bbox }),
  });
}
