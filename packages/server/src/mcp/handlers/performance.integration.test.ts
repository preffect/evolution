// Integration (docs/testing/tiers-and-builders.md §2): a room the lobby started, stepped by its ManualClock +
// ManualTicker (docs/determinism/contract-and-clock.md §2), read back through `debug_get_room_performance` (#340).
import { describe, expect, it, vi } from 'vitest';
import { SNAPSHOT_EVERY_TICKS, TICK_INTERVAL_MS } from '@evolution/shared';
import { registerPerformanceTools } from './performance.js';
import {
  createActiveRoomFixture,
  createManualRoomTiming,
  createSpyGameModule,
  parseToolJson,
} from '../../testing/builders.js';
import type { PerformanceStats } from '../../lobby/performance-tracker.js';

/** What one simulation step costs on the injected clock. */
const STEP_MS = 3;
/** What one `serializeRoomState` costs: the slow broadcast the tick time must show. */
const SERIALIZE_MS = 11;
/** Broadcast intervals the room runs before it is read. */
const BROADCAST_INTERVALS = 4;

describe('debug_get_room_performance through the room loop', () => {
  it('reports the broadcast inside the tick time and on its own', async () => {
    const timing = createManualRoomTiming();
    const gameFactory = () => {
      const gameModule = createSpyGameModule();
      vi.mocked(gameModule.reduceGameState).mockImplementation(() => timing.clock.advanceMilliseconds(STEP_MS));
      const serialize = vi.mocked(gameModule.serializeRoomState);
      const echo = serialize.getMockImplementation()!;
      serialize.mockImplementation(() => {
        timing.clock.advanceMilliseconds(SERIALIZE_MS);
        return echo();
      });
      return gameModule;
    };
    const fixture = createActiveRoomFixture({ gameFactory, createRoomTiming: () => timing });
    registerPerformanceTools(fixture.mcp, fixture.context);
    for (let tick = 0; tick < BROADCAST_INTERVALS * SNAPSHOT_EVERY_TICKS; tick += 1) {
      timing.clock.advanceMilliseconds(TICK_INTERVAL_MS);
      timing.ticker.fire();
    }

    const [stats] = parseToolJson(
      await fixture.call('debug_get_room_performance', { gameId: fixture.gameId }),
    ) as PerformanceStats[];
    // The injected costs run on the room's own clock, so the accumulator owes catch-up ticks for them too.
    const ticks = fixture.room.getTickCount();
    const broadcastMsPerTick = (Math.floor(ticks / SNAPSHOT_EVERY_TICKS) * SERIALIZE_MS) / ticks;
    expect(stats).toMatchObject({
      sampleCount: ticks,
      tickPeakMs: STEP_MS + SERIALIZE_MS,
      broadcastPeakMs: SERIALIZE_MS,
    });
    expect(stats!.tickAvgMs).toBeCloseTo(STEP_MS + broadcastMsPerTick, 2);
    expect(stats!.broadcastAvgMs).toBeCloseTo(broadcastMsPerTick, 2);
    fixture.stop();
  });
});
