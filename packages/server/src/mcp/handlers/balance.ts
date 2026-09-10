import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { BalancePatch } from '../../game/debug/simulation-debug-handle.js';
import type { DebugContext } from '../debug-context.js';
import { GAME_ID_ARGUMENT, registerCapabilityTool } from './capability-tool.js';

/** Nested records of number leaves, mirroring `data/balance.json` (docs/CODE-STANDARDS.md §2). */
const BALANCE_PATCH_SCHEMA: z.ZodType<BalancePatch> = z.lazy(() =>
  z.record(z.union([z.number(), BALANCE_PATCH_SCHEMA])),
);

/** Live tuning: read the balance a room simulates with and patch its number leaves. */
export function registerBalanceTools(mcp: McpServer, context: DebugContext): void {
  registerCapabilityTool(mcp, context, {
    name: 'debug_get_balance',
    description: "The live balance config of a game (the shape of data/balance.json, with the room's current values)",
    capability: 'getBalance',
    schema: { gameId: GAME_ID_ARGUMENT },
    run: (handle) => handle.getBalance(),
  });
  registerCapabilityTool(mcp, context, {
    name: 'debug_set_balance',
    description: 'Patch number leaves of the live balance of a game (e.g. { ecology: { FOOD_CAP_BASE: 900 } })',
    capability: 'patchBalance',
    schema: { gameId: GAME_ID_ARGUMENT, patch: BALANCE_PATCH_SCHEMA.describe('Nested record of number leaves') },
    run: (handle, input) => handle.patchBalance(input.patch),
  });
}
