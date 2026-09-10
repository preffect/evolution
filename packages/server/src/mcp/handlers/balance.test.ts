import { describe, expect, it, vi } from 'vitest';
import { registerBalanceTools } from './balance.js';
import { createActiveRoomFixture, createDebugCapableGameModule, parseToolJson } from '../../testing/builders.js';

function capableFixture() {
  const balance = { ecology: { foodCapBase: 800 } };
  const handle = {
    getBalance: vi.fn(() => balance),
    patchBalance: vi.fn((patch: { ecology: { foodCapBase: number } }) => ({ ecology: { ...patch.ecology } })),
  };
  const fixture = createActiveRoomFixture({ gameFactory: () => createDebugCapableGameModule(handle) });
  registerBalanceTools(fixture.mcp, fixture.context);
  return { ...fixture, handle };
}

describe('debug_get_balance', () => {
  it('returns the live balance of the room', async () => {
    const fixture = capableFixture();
    const result = await fixture.call('debug_get_balance', { gameId: fixture.gameId });
    expect(parseToolJson(result)).toEqual({ ecology: { foodCapBase: 800 } });
    fixture.stop();
  });
});

describe('debug_set_balance', () => {
  it('forwards the patch and returns the patched balance', async () => {
    const fixture = capableFixture();
    const patch = { ecology: { foodCapBase: 900 } };
    const result = await fixture.call('debug_set_balance', { gameId: fixture.gameId, patch });
    expect(parseToolJson(result)).toEqual({ ecology: { foodCapBase: 900 } });
    expect(fixture.handle.patchBalance).toHaveBeenCalledWith(patch);
    fixture.stop();
  });
});

describe('balance tools without a capable module', () => {
  it.each(['debug_get_balance', 'debug_set_balance'])('%s is not supported', async (tool) => {
    const fixture = createActiveRoomFixture();
    registerBalanceTools(fixture.mcp, fixture.context);
    expect((await fixture.call(tool, { gameId: fixture.gameId, patch: {} })).isError).toBe(true);
    fixture.stop();
  });
});
