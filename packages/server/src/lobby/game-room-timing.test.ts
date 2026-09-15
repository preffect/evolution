// The room loop's tick telemetry (#340): the step and the broadcast measured on the injected clock
// (docs/determinism/contract-and-clock.md §2), the broadcast's share recorded on its own.
import { describe, expect, it, vi } from 'vitest';
import { SNAPSHOT_EVERY_TICKS, TICK_INTERVAL_MS } from '@evolution/shared';
import { GameRoom } from './game-room.js';
import { createManualRoomTiming, createSpyGameModule, createTestRoomInitOptions } from '../testing/builders.js';

/** What one simulation step costs on the injected clock. */
const STEP_MS = 2;
/** What one `serializeRoomState` costs on the injected clock. */
const SERIALIZE_MS = 5;
/** What each clock read costs on a clock that moves per read: the room's own reads stand in for real work. */
const CLOCK_READ_COST_MS = 0.25;

describe('game-room: tick timing', () => {
  it('measures tick time with the injected clock', () => {
    const gameModule = createSpyGameModule();
    const timing = createManualRoomTiming();
    vi.mocked(gameModule.reduceGameState).mockImplementation(() => timing.clock.advanceMilliseconds(STEP_MS));
    const room = new GameRoom(gameModule, createTestRoomInitOptions(['p1']), timing);
    room.start();
    timing.clock.advanceMilliseconds(TICK_INTERVAL_MS);
    timing.ticker.fire();
    expect(room.performanceTracker.getStats().tickPeakMs).toBe(STEP_MS);
  });

  it('counts a slow broadcast in the tick time and reports it as the broadcast share', () => {
    const gameModule = createSpyGameModule();
    const timing = createManualRoomTiming();
    vi.mocked(gameModule.reduceGameState).mockImplementation(() => timing.clock.advanceMilliseconds(STEP_MS));
    const serialize = vi.mocked(gameModule.serializeRoomState);
    const echo = serialize.getMockImplementation()!;
    serialize.mockImplementation(() => {
      timing.clock.advanceMilliseconds(SERIALIZE_MS);
      return echo();
    });
    const room = new GameRoom(gameModule, createTestRoomInitOptions(['p1']), timing);
    room.start();
    for (let tick = 0; tick < SNAPSHOT_EVERY_TICKS; tick += 1) {
      timing.clock.advanceMilliseconds(TICK_INTERVAL_MS);
      timing.ticker.fire();
    }
    const tickMs = STEP_MS + SERIALIZE_MS;
    expect(room.performanceTracker.worstTick()).toMatchObject({
      tickMs,
      broadcastMs: SERIALIZE_MS,
      isBroadcastTick: true,
    });
    expect(room.performanceTracker.getStats()).toMatchObject({
      tickPeakMs: tickMs,
      broadcastPeakMs: SERIALIZE_MS,
      broadcastP95Ms: SERIALIZE_MS,
    });
  });

  it('records no broadcast time on a tick that does not broadcast, even on a clock that moves on every read', () => {
    const timing = createManualRoomTiming();
    const readClock = timing.clock.nowMilliseconds.bind(timing.clock);
    vi.spyOn(timing.clock, 'nowMilliseconds').mockImplementation(() => {
      timing.clock.advanceMilliseconds(CLOCK_READ_COST_MS);
      return readClock();
    });
    const room = new GameRoom(createSpyGameModule(), createTestRoomInitOptions(['p1']), timing);
    room.step(SNAPSHOT_EVERY_TICKS - 1);
    const stats = room.performanceTracker.getStats();
    expect(stats.tickPeakMs).toBeGreaterThan(0);
    expect(stats).toMatchObject({ broadcastAvgMs: 0, broadcastP95Ms: 0, broadcastPeakMs: 0 });
    expect(room.performanceTracker.worstTick()).toMatchObject({ broadcastMs: 0, isBroadcastTick: false });
  });
});
