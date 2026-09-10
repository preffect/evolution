import { describe, expect, it, vi } from 'vitest';
import { registerPlayerTools } from './player.js';
import { createActiveRoomFixture, createDebugCapableGameModule, parseToolJson } from '../../testing/builders.js';

function capableFixture() {
  const handle = {
    getPlayerDebugState: vi.fn((playerId: string) => (playerId === 'alice' ? { level: 2 } : undefined)),
    grantDna: vi.fn(() => ({ dna: 12 })),
    setPlayer: vi.fn(() => ({ mass: 40 })),
  };
  const fixture = createActiveRoomFixture({ gameFactory: () => createDebugCapableGameModule(handle) });
  registerPlayerTools(fixture.mcp, fixture.context);
  return { ...fixture, handle };
}

describe('debug_get_player_progress', () => {
  it('returns the handle state of a known player', async () => {
    const fixture = capableFixture();
    const result = await fixture.call('debug_get_player_progress', { gameId: fixture.gameId, playerId: 'alice' });
    expect(parseToolJson(result)).toEqual({ level: 2 });
    fixture.stop();
  });

  it('is an error for a player the handle does not know', async () => {
    const fixture = capableFixture();
    const result = await fixture.call('debug_get_player_progress', { gameId: fixture.gameId, playerId: 'zed' });
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ text: expect.stringContaining('"zed"') });
    fixture.stop();
  });
});

describe('debug_grant_dna', () => {
  it('forwards the grant and returns the handle result', async () => {
    const fixture = capableFixture();
    const input = { gameId: fixture.gameId, playerId: 'alice', dna: 12, tags: ['motile'] };
    expect(parseToolJson(await fixture.call('debug_grant_dna', input))).toEqual({ dna: 12 });
    expect(fixture.handle.grantDna).toHaveBeenCalledWith('alice', { dna: 12, tags: ['motile'] });
    fixture.stop();
  });
});

describe('debug_set_player', () => {
  it('forwards exactly the given fields as the patch', async () => {
    const fixture = capableFixture();
    const input = { gameId: fixture.gameId, playerId: 'alice', mass: 40, position: { x: 1, y: 2 } };
    expect(parseToolJson(await fixture.call('debug_set_player', input))).toEqual({ mass: 40 });
    expect(fixture.handle.setPlayer).toHaveBeenCalledWith('alice', {
      mass: 40,
      level: undefined,
      traits: undefined,
      position: { x: 1, y: 2 },
    });
    fixture.stop();
  });
});

describe('player tools without a capable module', () => {
  it.each(['debug_get_player_progress', 'debug_grant_dna', 'debug_set_player'])('%s is not supported', async (tool) => {
    const fixture = createActiveRoomFixture();
    registerPlayerTools(fixture.mcp, fixture.context);
    expect((await fixture.call(tool, { gameId: fixture.gameId, playerId: 'alice', dna: 1 })).isError).toBe(true);
    fixture.stop();
  });
});
