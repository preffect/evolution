import { describe, expect, it } from 'vitest';
import { CLIENT_MESSAGE_TYPE, RENDER_STAGE, RENDER_STAGE_NAMES, SERVER_MESSAGE_TYPE } from './messages.js';

const WIRE_VERB_PATTERN = /^[a-z]+(_[a-z]+)*$/;

describe('message type ids', () => {
  it.each([
    ['CLIENT_MESSAGE_TYPE', CLIENT_MESSAGE_TYPE],
    ['SERVER_MESSAGE_TYPE', SERVER_MESSAGE_TYPE],
  ])('%s values are unique snake_case wire verbs', (_name, table) => {
    const values = Object.values(table);
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) expect(value).toMatch(WIRE_VERB_PATTERN);
  });

  it('client and server verbs do not overlap', () => {
    const clientValues = new Set<string>(Object.values(CLIENT_MESSAGE_TYPE));
    for (const value of Object.values(SERVER_MESSAGE_TYPE)) expect(clientValues.has(value)).toBe(false);
  });
});

describe('RENDER_STAGE_NAMES', () => {
  it('lists every RENDER_STAGE key exactly once (docs/RENDERING.md §7)', () => {
    expect([...RENDER_STAGE_NAMES].sort()).toEqual(Object.values(RENDER_STAGE).sort());
    expect(new Set(RENDER_STAGE_NAMES).size).toBe(RENDER_STAGE_NAMES.length);
  });
});
