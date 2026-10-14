import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { BalancePatch } from '../../game/debug/simulation-debug-handle.js';
import type { DebugContext } from '../debug-context.js';
import { GAME_ID_ARGUMENT, registerCapabilityTool } from './capability-tool.js';

/**
 * Nested records mirroring `data/balance.json` (docs/CODE-STANDARDS.md §2): number leaves, and the shapes a declared
 * non-number leaf may take (a stage id is a string). Which path takes which is the patch's to check
 * (`game/debug/balance-patch.ts`), so a refusal names the leaf and what it takes.
 */
const BALANCE_PATCH_SCHEMA: z.ZodType<BalancePatch> = z.lazy(() =>
  z.record(z.union([z.number(), z.string(), z.array(z.string()), BALANCE_PATCH_SCHEMA])),
);

/**
 * Live tuning: read the balance a room simulates with and patch its number leaves and its declared non-number leaves
 * (the swallow switch's stage id, docs/architecture/debug-mcp.md §8). A patch is
 * announced to every player as `balance_updated` (docs/architecture/wire-contract.md §4).
 */
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
    description:
      "Patch number leaves of the live balance of a game (e.g. { ecology: { FOOD_CAP_BASE: 900 } }) and its stage-id leaves (e.g. { absorption: { SWALLOW_FROM_STAGE: 'eukaryote' } })",
    capability: 'patchBalance',
    isWorldMutation: true,
    schema: {
      gameId: GAME_ID_ARGUMENT,
      patch: BALANCE_PATCH_SCHEMA.describe('Nested record of number leaves and declared stage-id leaves'),
    },
    run: (handle, input, room) => {
      const balance = handle.patchBalance(input.patch);
      room.broadcastBalanceUpdated();
      return balance;
    },
  });
}
