import { describe, expect, it } from 'vitest';
import { DEBUG_JSON_INDENT_SPACES } from './debug.js';
import { CLIENT_ID_STORAGE_KEY } from './identity.js';

describe('debug and identity constants', () => {
  it('pretty-prints with a positive whole-number indent', () => {
    expect(Number.isInteger(DEBUG_JSON_INDENT_SPACES)).toBe(true);
    expect(DEBUG_JSON_INDENT_SPACES).toBeGreaterThan(0);
  });

  it('namespaces the storage key so it cannot collide with another app on the same origin', () => {
    expect(CLIENT_ID_STORAGE_KEY).toMatch(/^[a-z-]+\.clientId$/);
  });
});
