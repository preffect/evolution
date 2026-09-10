import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DebugContext } from '../debug-context.js';
import { GAME_ID_ARGUMENT, registerCapabilityTool } from './capability-tool.js';

/** Reseeding, hashing and replay export: the tools visual regression and replays lean on (docs/DETERMINISM.md). */
export function registerDeterminismTools(mcp: McpServer, context: DebugContext): void {
  registerCapabilityTool(mcp, context, {
    name: 'debug_set_seed',
    description: 'Rebuild every random stream of a game from a new seed, for reproducible spawns',
    capability: 'reseed',
    schema: {
      gameId: GAME_ID_ARGUMENT,
      seed: z.number().int().nonnegative().safe().describe('The new round seed (non-negative integer)'),
    },
    run: (handle, input) => {
      handle.reseed(input.seed);
      return { gameId: input.gameId, seed: input.seed };
    },
  });
  registerCapabilityTool(mcp, context, {
    name: 'debug_get_state_hash',
    description: 'The canonical state hash of a game right now (what replays and determinism tests compare)',
    capability: 'computeStateHash',
    schema: { gameId: GAME_ID_ARGUMENT },
    run: (handle, input, room) => ({
      gameId: input.gameId,
      tick: room.getTickCount(),
      hash: handle.computeStateHash(),
    }),
  });
  registerCapabilityTool(mcp, context, {
    name: 'debug_export_replay',
    description: "Export the current round's replay recording (seed, config, balance, inputs, debug patches)",
    capability: 'exportReplay',
    schema: { gameId: GAME_ID_ARGUMENT },
    run: (handle) => handle.exportReplay(),
  });
}
