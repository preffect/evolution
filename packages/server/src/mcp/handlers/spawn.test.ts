import { describe, expect, it, vi } from 'vitest';
import { registerSpawnTools } from './spawn.js';
import { createActiveRoomFixture, createDebugCapableGameModule, parseToolJson } from '../../testing/builders.js';

describe('debug_spawn', () => {
  it('forwards the spawn request and returns what the spawner made', async () => {
    const handle = { spawn: vi.fn(() => ({ id: 'f9' })) };
    const fixture = createActiveRoomFixture({ gameFactory: () => createDebugCapableGameModule(handle) });
    registerSpawnTools(fixture.mcp, fixture.context);
    const input = { gameId: fixture.gameId, kind: 'food_mote', x: 3, y: 4, params: { variant: 'green' } };
    expect(parseToolJson(await fixture.call('debug_spawn', input))).toEqual({ id: 'f9' });
    expect(handle.spawn).toHaveBeenCalledWith({ kind: 'food_mote', x: 3, y: 4, params: { variant: 'green' } });
    fixture.stop();
  });

  it('is not supported by a module without a spawner', async () => {
    const fixture = createActiveRoomFixture();
    registerSpawnTools(fixture.mcp, fixture.context);
    const input = { gameId: fixture.gameId, kind: 'food_mote', x: 0, y: 0, params: {} };
    expect((await fixture.call('debug_spawn', input)).isError).toBe(true);
    fixture.stop();
  });
});
