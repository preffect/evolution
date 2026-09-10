import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DebugContext } from '../debug-context.js';
import { registerBalanceTools } from './balance.js';
import { registerBotTools } from './bots.js';
import { registerDeterminismTools } from './determinism.js';
import { registerEntityTools } from './entities.js';
import { registerPlayerTools } from './player.js';
import { registerRoomLoopTools } from './room-loop.js';
import { registerSpawnTools } from './spawn.js';

/**
 * The game-specific debug surface (docs/ARCHITECTURE.md §8). Every tool here reaches the
 * simulation through the room's `SimulationDebugHandle`, so it works with whichever module the
 * lobby was built with: a module that lacks a capability answers "not supported", never a stub.
 */
export function registerGameSpecificTools(mcp: McpServer, context: DebugContext): void {
  registerEntityTools(mcp, context);
  registerPlayerTools(mcp, context);
  registerSpawnTools(mcp, context);
  registerRoomLoopTools(mcp, context);
  registerDeterminismTools(mcp, context);
  registerBalanceTools(mcp, context);
  registerBotTools(mcp, context);
}
