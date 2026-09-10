import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { DEBUG_JSON_INDENT_SPACES } from '@evolution/shared';

/** Every debug tool answers with one text block, so the helpers below are the only result builders. */
export type TextToolResult = CallToolResult;

/** A successful result carrying `value` pretty-printed as JSON. */
export function jsonResult(value: unknown): TextToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, DEBUG_JSON_INDENT_SPACES) }] };
}

/** A failed result carrying a one-line explanation. */
export function errorResult(text: string): TextToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

export function gameNotFoundResult(gameId: string): TextToolResult {
  return errorResult(`Game "${gameId}" not found or not active`);
}
