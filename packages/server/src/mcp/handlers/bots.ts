import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DEFAULT_BOT_SEED, playerId } from '@evolution/shared';
import { BOT_STRATEGY_NAMES } from '../../game/bots/strategy-constants.js';
import type { DebugContext } from '../debug-context.js';
import { GAME_ID_ARGUMENT, PLAYER_ID_ARGUMENT, registerCapabilityTool } from './capability-tool.js';

/**
 * `debug_spawn_bot` / `debug_remove_bot` (docs/ARCHITECTURE.md §8, docs/TESTING.md §8.3): the
 * module builds and drives the bot (`spawnBot` / `removeBot`); the room enrols the synthetic
 * player so the lobby and the other clients see a normal player, and claims the seat before the
 * module holds the bot (`seat`), so a refused id leaves nothing behind. The strategy name is
 * validated once, here, by the schema: the handle and the roster only ever see a `BotStrategyName`.
 */
export function registerBotTools(mcp: McpServer, context: DebugContext): void {
  registerCapabilityTool(mcp, context, {
    name: 'debug_spawn_bot',
    description: `Spawn an in-process bot as a new player driven by a strategy (${BOT_STRATEGY_NAMES.join(', ')})`,
    capability: 'spawnBot',
    isWorldMutation: true,
    schema: {
      gameId: GAME_ID_ARGUMENT,
      behavior: z.enum(BOT_STRATEGY_NAMES).describe(`Strategy name: one of ${BOT_STRATEGY_NAMES.join(', ')}`),
      seed: z.number().int().default(DEFAULT_BOT_SEED).describe('Seed the bot forks its random stream from'),
      preyPlayerId: z.string().optional().describe('hunter only: hunt this player alone'),
    },
    run: (handle, input, room) => {
      const preyPlayerId = input.preyPlayerId === undefined ? undefined : playerId(input.preyPlayerId);
      const request = { behavior: input.behavior, seed: input.seed, preyPlayerId };
      return handle.spawnBot(request, (bot) => room.addSyntheticPlayer(bot));
    },
  });
  registerCapabilityTool(mcp, context, {
    name: 'debug_remove_bot',
    description: 'Remove a bot spawned by debug_spawn_bot from the game and its roster',
    capability: 'removeBot',
    isWorldMutation: true,
    schema: { gameId: GAME_ID_ARGUMENT, playerId: PLAYER_ID_ARGUMENT },
    run: (handle, input, room) => {
      const bot = handle.removeBot(input.playerId);
      room.removeSyntheticPlayer(input.playerId);
      return bot;
    },
  });
}
