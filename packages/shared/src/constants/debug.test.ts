import { describe, expect, it } from 'vitest';
import { ENTITY_KIND } from '../types/game.js';
import { DEBUG_JSON_INDENT_SPACES, DEFAULT_BOT_SEED, GIANT_SPAWN_KIND } from './debug.js';
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

  it('names the giant spawn kind apart from every entity kind debug_spawn takes', () => {
    expect(Object.values(ENTITY_KIND)).not.toContain(GIANT_SPAWN_KIND);
  });

  it('namespaces the storage key so it cannot collide with another app on the same origin', () => {
    expect(CLIENT_ID_STORAGE_KEY).toMatch(/^[a-z-]+\.clientId$/);
  });
});
