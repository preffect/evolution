import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { GAME_ERA, GAME_ERA_ORDER } from '@evolution/shared';
import type { DebugContext } from '../debug-context.js';
import { GAME_ID_ARGUMENT, registerCapabilityTool } from './capability-tool.js';

/**
 * The era jump (docs/architecture/debug-mcp.md §8, docs/game-design/phases.md §14.2.4): moves a round forward to a later
 * era in play by moving its `roundStartTick` back, never the tick counter; the next step is the era's first tick and
 * runs every move the jump crosses. Recorded as a `debug_patch`, so `debug_export_replay` reproduces the hash across it.
 */
export function registerEraTools(mcp: McpServer, context: DebugContext): void {
  registerCapabilityTool(mcp, context, {
    name: 'debug_set_era',
    description:
      'Jump a game forward to a later era in play (the next step is its first tick; roundStartTick moves back, possibly below 0). Refuses an era not in eras.ERAS_IN_PLAY, past the round, or not after the current one',
    capability: 'setEra',
    isWorldMutation: true,
    schema: {
      gameId: GAME_ID_ARGUMENT,
      era: z.nativeEnum(GAME_ERA).describe(`The era to jump to: one of ${GAME_ERA_ORDER.join(', ')}`),
    },
    run: (handle, input) => handle.setEra(input.era),
  });
}
