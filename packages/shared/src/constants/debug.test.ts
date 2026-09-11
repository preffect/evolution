import { describe, expect, it } from 'vitest';
import { DEBUG_JSON_INDENT_SPACES, DEFAULT_BOT_SEED } from './debug.js';
import { SEED_MAX } from './session.js';
import { CLIENT_ID_STORAGE_KEY } from './identity.js';

describe('debug and identity constants', () => {
  it('pretty-prints with a positive whole-number indent', () => {
    expect(Number.isInteger(DEBUG_JSON_INDENT_SPACES)).toBe(true);
    expect(DEBUG_JSON_INDENT_SPACES).toBeGreaterThan(0);
  });

  it('forks bots from a valid seed by default', () => {
    expect(Number.isInteger(DEFAULT_BOT_SEED)).toBe(true);
    expect(DEFAULT_BOT_SEED).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_BOT_SEED).toBeLessThanOrEqual(SEED_MAX);
  });

  it('namespaces the storage key so it cannot collide with another app on the same origin', () => {
    expect(CLIENT_ID_STORAGE_KEY).toMatch(/^[a-z-]+\.clientId$/);
  });
});
