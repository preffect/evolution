import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DebugRequestError } from '../../game/debug/debug-request-error.js';
import type { DebugContext } from '../debug-context.js';
import { GAME_ID_ARGUMENT, PLAYER_ID_ARGUMENT, registerCapabilityTool } from './capability-tool.js';

const TRAIT_IDS_ARGUMENT = z.array(z.string()).describe('Trait ids');
const POSITION_ARGUMENT = z.object({ x: z.number(), y: z.number() }).describe('World-unit position');

function registerGetPlayerProgressTool(mcp: McpServer, context: DebugContext): void {
  registerCapabilityTool(mcp, context, {
    name: 'debug_get_player_progress',
    description: "A player's full cell state: traits, modifiers, stage, level, DNA progress and the current offer",
    capability: 'getPlayerDebugState',
    schema: { gameId: GAME_ID_ARGUMENT, playerId: PLAYER_ID_ARGUMENT },
    run: (handle, input) => {
      const state = handle.getPlayerDebugState(input.playerId);
      if (state === undefined)
        throw new DebugRequestError(`Player "${input.playerId}" is not in game "${input.gameId}"`);
      return state;
    },
  });
}

function registerGrantDnaTool(mcp: McpServer, context: DebugContext): void {
  registerCapabilityTool(mcp, context, {
    name: 'debug_grant_dna',
    description: 'Grant DNA to a player (logged in the replay), optionally tagged',
    capability: 'grantDna',
    schema: {
      gameId: GAME_ID_ARGUMENT,
      playerId: PLAYER_ID_ARGUMENT,
      dna: z.number().positive().describe('DNA points to grant'),
      tags: z.array(z.string()).optional().describe('DNA tags the grant counts toward'),
    },
    run: (handle, input) => handle.grantDna(input.playerId, { dna: input.dna, tags: input.tags }),
  });
}

function registerSetPlayerTool(mcp: McpServer, context: DebugContext): void {
  registerCapabilityTool(mcp, context, {
    name: 'debug_set_player',
    description: "Overwrite parts of a player's cell: mass, level, owned traits and/or position",
    capability: 'setPlayer',
    schema: {
      gameId: GAME_ID_ARGUMENT,
      playerId: PLAYER_ID_ARGUMENT,
      mass: z.number().positive().optional(),
      level: z.number().int().min(1).optional(),
      traits: TRAIT_IDS_ARGUMENT.optional(),
      position: POSITION_ARGUMENT.optional(),
    },
    run: (handle, input) =>
      handle.setPlayer(input.playerId, {
        mass: input.mass,
        level: input.level,
        traits: input.traits,
        position: input.position,
      }),
  });
}

/** Player inspection and manipulation: progress, DNA grants and direct cell patches. */
export function registerPlayerTools(mcp: McpServer, context: DebugContext): void {
  registerGetPlayerProgressTool(mcp, context);
  registerGrantDnaTool(mcp, context);
  registerSetPlayerTool(mcp, context);
}
