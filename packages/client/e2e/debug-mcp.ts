// The debug MCP from a Playwright spec (docs/architecture/debug-mcp.md §8): staging a room with the same tools an
// agent uses, through the client's own proxy so a spec can only ever reach its own stack. One `tools/call` per
// request; the answer is the SSE `data:` line's first text content, parsed as JSON.

import type { Page } from '@playwright/test';

let requestId = 0;

/** Calls one debug tool and returns its JSON answer. */
export async function callDebugTool(page: Page, name: string, args: Record<string, unknown>): Promise<unknown> {
  requestId += 1;
  const text = await page.evaluate(
    async ([toolName, toolArgs, id]) => {
      const response = await fetch('/debug-mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          method: 'tools/call',
          params: { name: toolName, arguments: toolArgs },
        }),
      });
      const body = await response.text();
      const dataLine = body.split('\n').find((line) => line.startsWith('data:'));
      const message = JSON.parse(dataLine === undefined ? body : dataLine.slice('data:'.length)) as {
        result?: { content?: { text?: string }[] };
      };
      return message.result?.content?.[0]?.text ?? 'null';
    },
    [name, args, requestId] as const,
  );
  return JSON.parse(text) as unknown;
}

/** The room this page just opened and its one seat: the newest game, and its only connection. */
export async function ownRoom(page: Page): Promise<{ gameId: string; playerId: string }> {
  const listed = (await callDebugTool(page, 'debug_list_games', {})) as
    { games?: { gameId: string }[] } | { gameId: string }[];
  const games = Array.isArray(listed) ? listed : (listed.games ?? []);
  const gameId = games[games.length - 1]?.gameId;
  if (gameId === undefined) throw new Error('no room to stage');
  const connections = (await callDebugTool(page, 'debug_get_connections', { gameId })) as { playerId: string }[];
  const playerId = connections[0]?.playerId;
  if (playerId === undefined) throw new Error('the room has no seat');
  return { gameId, playerId };
}
