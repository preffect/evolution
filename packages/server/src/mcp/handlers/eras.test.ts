import { describe, expect, it, vi } from 'vitest';
import { GAME_ERA } from '@evolution/shared';
import { registerEraTools } from './eras.js';
import { createActiveRoomFixture, createDebugCapableGameModule, parseToolJson } from '../../testing/builders.js';

/** What a capable module answers: the era, its first tick and the round start that makes it so. */
const JUMP = { era: GAME_ERA.pool, firstTick: 600, roundStartTick: -35_400 };

function capableFixture() {
  const handle = { setEra: vi.fn(() => JUMP) };
  const fixture = createActiveRoomFixture({ gameFactory: () => createDebugCapableGameModule(handle) });
  registerEraTools(fixture.mcp, fixture.context);
  return { ...fixture, handle };
}

describe('debug_set_era', () => {
  it("forwards the era and answers with the module's jump", async () => {
    const fixture = capableFixture();
    const result = await fixture.call('debug_set_era', { gameId: fixture.gameId, era: GAME_ERA.pool });
    expect(parseToolJson(result)).toEqual(JUMP);
    expect(fixture.handle.setEra).toHaveBeenCalledWith(GAME_ERA.pool);
    fixture.stop();
  });

  it('refuses a name that is no era before the module sees it', async () => {
    const fixture = capableFixture();
    expect((await fixture.call('debug_set_era', { gameId: fixture.gameId, era: 'pond' })).isError).toBe(true);
    expect(fixture.handle.setEra).not.toHaveBeenCalled();
    fixture.stop();
  });

  it('is not supported by a module without the capability', async () => {
    const fixture = createActiveRoomFixture();
    registerEraTools(fixture.mcp, fixture.context);
    expect((await fixture.call('debug_set_era', { gameId: fixture.gameId, era: GAME_ERA.pool })).isError).toBe(true);
    fixture.stop();
  });
});
