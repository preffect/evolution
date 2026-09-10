// Integration (docs/TESTING.md §2): the /debug-mcp mount answers JSON-RPC `tools/list` and
// `tools/call` over Fastify's in-process injection, proving the transport + tool registration
// + zod argument wire.
import { describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerMcpEndpoint } from './mcp-server.js';
import { createTestDebugContext } from '../testing/builders.js';

const GENERIC_TOOLS = [
  'debug_get_connections',
  'debug_get_performance',
  'debug_get_room_performance',
  'debug_list_games',
  'debug_get_room',
  'debug_get_game_state',
];

/** The game-specific surface of docs/ARCHITECTURE.md §8. */
const GAME_SPECIFIC_TOOLS = [
  'debug_get_player_progress',
  'debug_get_entities',
  'debug_grant_dna',
  'debug_spawn',
  'debug_set_player',
  'debug_pause_room',
  'debug_step_room',
  'debug_resume_room',
  'debug_set_seed',
  'debug_get_balance',
  'debug_set_balance',
  'debug_get_state_hash',
  'debug_export_replay',
];

/** Streamable HTTP answers as an SSE stream; the first `data:` line carries the JSON-RPC result. */
function firstJsonRpcResponse(body: string): {
  result?: { tools?: { name: string }[]; isError?: boolean; content?: { text?: string }[] };
  error?: unknown;
} {
  const dataLine = body.split('\n').find((line) => line.startsWith('data:'));
  if (!dataLine) throw new Error(`no data line in ${body}`);
  return JSON.parse(dataLine.slice('data:'.length));
}

/** The text of a tool result's first block: where the SDK's validation error and the handler's refusal both land. */
function firstResultText(body: string): string | undefined {
  return firstJsonRpcResponse(body).result?.content?.[0]?.text;
}

function postJsonRpc(server: FastifyInstance, method: string, params: unknown) {
  return server.inject({
    method: 'POST',
    url: '/debug-mcp',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    payload: { jsonrpc: '2.0', id: 1, method, params },
  });
}

describe('/debug-mcp', () => {
  it('lists every generic and game-specific debug tool', async () => {
    const server = Fastify();
    registerMcpEndpoint(server, createTestDebugContext());
    const response = await postJsonRpc(server, 'tools/list', {});
    expect(response.statusCode).toBe(200);
    const names = firstJsonRpcResponse(response.body).result?.tools?.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining([...GENERIC_TOOLS, ...GAME_SPECIFIC_TOOLS]));
    await server.close();
  });

  it('parses tool arguments with zod before the handler runs', async () => {
    const server = Fastify();
    registerMcpEndpoint(server, createTestDebugContext());
    const rejected = await postJsonRpc(server, 'tools/call', {
      name: 'debug_step_room',
      arguments: { gameId: 'g', ticks: 0 },
    });
    expect(firstJsonRpcResponse(rejected.body).result?.isError).toBe(true);
    expect(firstResultText(rejected.body)).toMatch(/Input validation error/);
    const unknownGame = await postJsonRpc(server, 'tools/call', {
      name: 'debug_step_room',
      arguments: { gameId: 'g' },
    });
    expect(firstJsonRpcResponse(unknownGame.body).result?.isError).toBe(true);
    expect(firstResultText(unknownGame.body)).toMatch(/not found/);
    await server.close();
  });
});
