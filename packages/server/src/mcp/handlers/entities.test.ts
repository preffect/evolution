import { describe, expect, it, vi } from 'vitest';
import { registerEntityTools } from './entities.js';
import { createActiveRoomFixture, createDebugCapableGameModule, parseToolJson } from '../../testing/builders.js';

describe('debug_get_entities', () => {
  it('passes the kind and bbox filter to the handle and returns its listing', async () => {
    const handle = { listEntities: vi.fn(() => [{ id: 'c1', kind: 'cell' }]) };
    const fixture = createActiveRoomFixture({ gameFactory: () => createDebugCapableGameModule(handle) });
    registerEntityTools(fixture.mcp, fixture.context);
    const bbox = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const result = await fixture.call('debug_get_entities', { gameId: fixture.gameId, kind: 'cell', bbox });
    expect(parseToolJson(result)).toEqual([{ id: 'c1', kind: 'cell' }]);
    expect(handle.listEntities).toHaveBeenCalledWith({ kind: 'cell', bbox });
    fixture.stop();
  });

  it('is not supported by a module without entity inspection', async () => {
    const fixture = createActiveRoomFixture();
    registerEntityTools(fixture.mcp, fixture.context);
    expect((await fixture.call('debug_get_entities', { gameId: fixture.gameId })).isError).toBe(true);
    fixture.stop();
  });
});
