// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CONNECTION_STATE, connectionStateFor } from './connection-state';

describe('connectionStateFor', () => {
  it('puts a closed socket first, since it brings no snapshots either', () => {
    expect(connectionStateFor(false, false)).toBe(CONNECTION_STATE.disconnected);
    expect(connectionStateFor(false, true)).toBe(CONNECTION_STATE.disconnected);
  });

  it('is stale only with the socket up and the snapshots stopped', () => {
    expect(connectionStateFor(true, true)).toBe(CONNECTION_STATE.stale);
    expect(connectionStateFor(true, false)).toBe(CONNECTION_STATE.connected);
  });
});
