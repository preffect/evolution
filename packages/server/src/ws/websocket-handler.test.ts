import { describe, expect, it, vi } from 'vitest';
import { replaceExistingConnection, resolvePlayerId } from './websocket-handler.js';
import { createTestConnection } from '../testing/builders.js';

describe('resolvePlayerId', () => {
  it('uses the clientId query parameter when present', () => {
    expect(resolvePlayerId('/ws?clientId=abc')).toBe('abc');
  });

  it('mints a fresh id when the parameter is missing or empty', () => {
    const minted = resolvePlayerId('/ws');
    expect(minted.length).toBeGreaterThan(0);
    expect(resolvePlayerId('/ws?clientId=')).not.toBe('');
    expect(resolvePlayerId('/ws')).not.toBe(minted);
  });
});

describe('replaceExistingConnection', () => {
  it('marks the old connection replaced and closes its socket', () => {
    const existing = createTestConnection({ playerId: 'p1' });
    const close = vi.spyOn(existing.socket, 'close');
    replaceExistingConnection(existing);
    expect(existing.isReplaced).toBe(true);
    expect(close).toHaveBeenCalled();
  });

  it('tolerates a socket that throws on close and no existing connection at all', () => {
    const existing = createTestConnection({ playerId: 'p1' });
    vi.spyOn(existing.socket, 'close').mockImplementation(() => {
      throw new Error('already closed');
    });
    expect(() => replaceExistingConnection(existing)).not.toThrow();
    expect(() => replaceExistingConnection(undefined)).not.toThrow();
  });
});
