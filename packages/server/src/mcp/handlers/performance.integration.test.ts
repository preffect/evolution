// Integration (docs/testing/tiers-and-builders.md §2): a room the lobby started, stepped by its ManualClock +
// ManualTicker (docs/determinism/contract-and-clock.md §2), read back through `debug_get_room_performance` (#340).
import { describe, expect, it, vi } from 'vitest';
import {
  SERVER_MESSAGE_TYPE,
  SNAPSHOT_BACKLOG_LIMIT_TICKS,
  SNAPSHOT_EVERY_TICKS,
  TICK_INTERVAL_MS,
} from '@evolution/shared';
import { registerPerformanceTools } from './performance.js';
import {
  createActiveRoomFixture,
  createManualRoomTiming,
  createSpyGameModule,
  createTickingGameModule,
  parseToolJson,
} from '../../testing/builders.js';
import { roundToHundredths, type PerformanceStats } from '../../lobby/performance-tracker.js';
import type { SnapshotFlowTelemetry } from '../../lobby/snapshot-backlog.js';

/** What one simulation step costs on the injected clock. */
const STEP_MS = 3;
/** What one `serializeRoomState` costs: the slow broadcast the tick time must show. */
const SERIALIZE_MS = 11;
/** The player `createActiveRoomFixture` seats, and the tick of the ticking module's first broadcast. */
const PLAYER_ID = 'alice';
const FIRST_BROADCAST_TICK = 1;
/** Broadcast intervals the room runs before it is read. */
const BROADCAST_INTERVALS = 4;

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
        tickAvgMs: roundToHundredths(STEP_MS + broadcastMsPerTick),
        broadcastAvgMs: roundToHundredths(broadcastMsPerTick),
        broadcastP95Ms: SERIALIZE_MS,
        broadcastPeakMs: SERIALIZE_MS,
      });
    } finally {
      fixture.stop();
    }
  });

  it('#276: shows a skipped client with its backlog, then the resync it was sent', async () => {
    const fixture = createActiveRoomFixture({ gameFactory: () => createTickingGameModule() });
    const readFlow = async () => {
      const rooms = parseToolJson(await fixture.call('debug_get_room_performance', { gameId: fixture.gameId }));
      return (rooms as { snapshotFlow: SnapshotFlowTelemetry }[])[0]!.snapshotFlow;
    };
    try {
      registerPerformanceTools(fixture.mcp, fixture.context);
      fixture.room.step(SNAPSHOT_EVERY_TICKS);
      fixture.room.recordSnapshotAck(PLAYER_ID, FIRST_BROADCAST_TICK);
      fixture.room.step(SNAPSHOT_EVERY_TICKS * SNAPSHOT_BACKLOG_LIMIT_TICKS * 2);
      // The ticking module numbers its broadcasts: the room stops once the depth passes the limit.
      const lastTickSent = FIRST_BROADCAST_TICK + SNAPSHOT_BACKLOG_LIMIT_TICKS + 1;
      expect(await readFlow()).toEqual({
        resyncCount: 0,
        owedResyncCount: 1,
        players: { [PLAYER_ID]: { backlogTicks: lastTickSent - FIRST_BROADCAST_TICK, isOwedResync: true } },
      });

      // The client catches up; the paused room resyncs it on that ack (#300).
      fixture.room.recordSnapshotAck(PLAYER_ID, lastTickSent);
      const resync = fixture.sent[PLAYER_ID]!.at(-1) as { type: string; snapshot: { tick: number } };
      expect(resync.type).toBe(SERVER_MESSAGE_TYPE.gameState);
      // Until the client acknowledges it, the resync is what is in flight.
      expect(await readFlow()).toEqual({
        resyncCount: 1,
        owedResyncCount: 0,
        players: { [PLAYER_ID]: { backlogTicks: resync.snapshot.tick - lastTickSent, isOwedResync: false } },
      });
    } finally {
      fixture.stop();
    }
  });
});
