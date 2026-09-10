// Integration (docs/TESTING.md §2): the pause / step / resume tools against a real GameRoom that
// the lobby started, driven by the injected ManualClock + ManualTicker (docs/DETERMINISM.md §2).
import { describe, expect, it } from 'vitest';
import { SERVER_MESSAGE_TYPE, TICK_INTERVAL_MS } from '@evolution/shared';
import { registerRoomLoopTools } from './room-loop.js';
import { createActiveRoomFixture, createManualRoomTiming, parseToolJson } from '../../testing/builders.js';

function loopFixture() {
  const timing = createManualRoomTiming();
  const fixture = createActiveRoomFixture({ createRoomTiming: () => timing });
  registerRoomLoopTools(fixture.mcp, fixture.context);
  const advance = (intervals: number) => {
    timing.clock.advanceMilliseconds(TICK_INTERVAL_MS * intervals);
    timing.ticker.fire();
  };
  const snapshotsSentToAlice = () =>
    fixture.sent['alice']!.filter((message) => (message as { type: string }).type === SERVER_MESSAGE_TYPE.gameSnapshot)
      .length;
  return { ...fixture, advance, snapshotsSentToAlice };
}

describe('pause / step / resume through the room loop', () => {
  it('a paused room ignores the clock, steps exactly on request, and resumes without catching up', async () => {
    const fixture = loopFixture();
    fixture.advance(3);
    expect(fixture.room.getTickCount()).toBe(3);
    expect(fixture.snapshotsSentToAlice()).toBe(3);

    await fixture.call('debug_pause_room', { gameId: fixture.gameId });
    fixture.advance(4);
    expect(fixture.room.getTickCount()).toBe(3);

    const stepped = await fixture.call('debug_step_room', { gameId: fixture.gameId, ticks: 2 });
    expect(parseToolJson(stepped)).toEqual({ gameId: fixture.gameId, isPaused: true, tick: 5 });
    expect(fixture.snapshotsSentToAlice()).toBe(5);

    fixture.advance(4);
    await fixture.call('debug_resume_room', { gameId: fixture.gameId });
    fixture.advance(2);
    expect(fixture.room.getTickCount()).toBe(7);
    expect(fixture.room.performanceTracker.getStats().droppedTicks).toBe(0);
    fixture.stop();
  });
});
