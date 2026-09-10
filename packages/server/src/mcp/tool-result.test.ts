import { describe, expect, it } from 'vitest';
import { DEBUG_JSON_INDENT_SPACES } from '@evolution/shared';
import { errorResult, gameNotFoundResult, jsonResult } from './tool-result.js';

describe('jsonResult', () => {
  it('pretty-prints the value as a single text block', () => {
    const value = { players: ['p1'] };
    expect(jsonResult(value)).toEqual({
      content: [{ type: 'text', text: JSON.stringify(value, null, DEBUG_JSON_INDENT_SPACES) }],
    });
  });

  it('is not flagged as an error', () => {
    expect(jsonResult(null).isError).toBeUndefined();
  });
});

describe('errorResult', () => {
  it('flags the result as an error and keeps the text verbatim', () => {
    expect(errorResult('boom')).toEqual({ content: [{ type: 'text', text: 'boom' }], isError: true });
  });
});

describe('gameNotFoundResult', () => {
  it('names the missing game id', () => {
    const result = gameNotFoundResult('g1');
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('"g1"') });
  });
});
