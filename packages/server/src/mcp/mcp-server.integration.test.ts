// Integration (docs/TESTING.md §2): the /debug-mcp mount answers a JSON-RPC `tools/list` over
// Fastify's in-process injection, proving the transport + tool registration wire.
import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
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

/** Streamable HTTP answers as an SSE stream; the first `data:` line carries the JSON-RPC result. */
function firstJsonRpcResult(body: string): { tools: { name: string }[] } {
  const dataLine = body.split('\n').find((line) => line.startsWith('data:'));
  if (!dataLine) throw new Error(`no data line in ${body}`);
  return JSON.parse(dataLine.slice('data:'.length)).result;
}

describe('/debug-mcp', () => {
  it('lists every generic debug tool', async () => {
    const server = Fastify();
    registerMcpEndpoint(server, createTestDebugContext());
    const response = await server.inject({
      method: 'POST',
      url: '/debug-mcp',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    });
    expect(response.statusCode).toBe(200);
    const names = firstJsonRpcResult(response.body).tools.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining(GENERIC_TOOLS));
    await server.close();
  });
});
