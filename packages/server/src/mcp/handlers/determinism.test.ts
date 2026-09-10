import { describe, expect, it, vi } from 'vitest';
import type { StateHash } from '@evolution/shared';
import { registerDeterminismTools } from './determinism.js';
import { createActiveRoomFixture, createDebugCapableGameModule, parseToolJson } from '../../testing/builders.js';

function capableFixture() {
  const handle = {
    reseed: vi.fn(),
    computeStateHash: vi.fn(() => 'deadbeef' as StateHash),
    exportReplay: vi.fn(() => ({ seed: 42, inputs: [] })),
  };
  const fixture = createActiveRoomFixture({ gameFactory: () => createDebugCapableGameModule(handle) });
  registerDeterminismTools(fixture.mcp, fixture.context);
  return { ...fixture, handle };
}

describe('debug_set_seed', () => {
  it('reseeds the module and echoes the seed', async () => {
    const fixture = capableFixture();
    const result = await fixture.call('debug_set_seed', { gameId: fixture.gameId, seed: 7 });
    expect(parseToolJson(result)).toEqual({ gameId: fixture.gameId, seed: 7 });
    expect(fixture.handle.reseed).toHaveBeenCalledWith(7);
    fixture.stop();
  });
});

describe('debug_get_state_hash', () => {
  it('returns the hash with the room tick it was taken at', async () => {
    const fixture = capableFixture();
    fixture.room.step(2);
    const result = await fixture.call('debug_get_state_hash', { gameId: fixture.gameId });
    expect(parseToolJson(result)).toEqual({ gameId: fixture.gameId, tick: 2, hash: 'deadbeef' });
    fixture.stop();
  });
});

describe('debug_export_replay', () => {
  it('returns the recording', async () => {
    const fixture = capableFixture();
    const result = await fixture.call('debug_export_replay', { gameId: fixture.gameId });
    expect(parseToolJson(result)).toEqual({ seed: 42, inputs: [] });
    fixture.stop();
  });
});

describe('determinism tools without a capable module', () => {
  it.each(['debug_set_seed', 'debug_get_state_hash', 'debug_export_replay'])('%s is not supported', async (tool) => {
    const fixture = createActiveRoomFixture();
    registerDeterminismTools(fixture.mcp, fixture.context);
    expect((await fixture.call(tool, { gameId: fixture.gameId, seed: 1 })).isError).toBe(true);
    fixture.stop();
  });
});
