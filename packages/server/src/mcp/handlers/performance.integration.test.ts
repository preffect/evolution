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
const HUNDREDTHS = 100;

/** The tracker reports hundredths, so an expectation is rounded the same way and compared exactly. */
function toHundredths(value: number): number {
  return Math.round(value * HUNDREDTHS) / HUNDREDTHS;
}

/** A spy module whose step and serialisation cost fixed time on the room's own clock. */
function slowModuleFactory(timing: ReturnType<typeof createManualRoomTiming>) {
  return () => {
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
}

describe('debug_get_room_performance through the room loop', () => {
  it('reports the broadcast inside the tick time and on its own', async () => {
    const timing = createManualRoomTiming();
    const fixture = createActiveRoomFixture({ gameFactory: slowModuleFactory(timing), createRoomTiming: () => timing });
    try {
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
        tickAvgMs: toHundredths(STEP_MS + broadcastMsPerTick),
        broadcastAvgMs: toHundredths(broadcastMsPerTick),
        broadcastP95Ms: SERIALIZE_MS,
        broadcastPeakMs: SERIALIZE_MS,
      });
    } finally {
      fixture.stop();
    }
  });
});
