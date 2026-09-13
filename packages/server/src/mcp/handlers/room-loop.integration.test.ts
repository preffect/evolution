// Integration (docs/TESTING.md §2): the pause / step / resume tools against a real GameRoom that
// the lobby started, driven by the injected ManualClock + ManualTicker (docs/DETERMINISM.md §2).
import { describe, expect, it } from 'vitest';
import { SERVER_MESSAGE_TYPE, SNAPSHOT_EVERY_TICKS, TICK_INTERVAL_MS } from '@evolution/shared';
import { registerRoomLoopTools } from './room-loop.js';
import { createActiveRoomFixture, createManualRoomTiming, parseToolJson } from '../../testing/builders.js';

function loopFixture() {
  const timing = createManualRoomTiming();
  const fixture = createActiveRoomFixture({ createRoomTiming: () => timing });
  registerRoomLoopTools(fixture.mcp, fixture.context);
  // One fire for the whole span, so a span above `MAX_TICKS_PER_ADVANCE` (5) would drop ticks and
  // fail the `droppedTicks` assertion below for a reason that is not pause/step/resume.
  const advance = (ticks: number) => {
    timing.clock.advanceMilliseconds(TICK_INTERVAL_MS * ticks);
    timing.ticker.fire();
  };
  const snapshotsSentToAlice = () =>
    fixture.sent['alice']!.filter((message) => (message as { type: string }).type === SERVER_MESSAGE_TYPE.gameSnapshot)
      .length;
  return { ...fixture, advance, snapshotsSentToAlice };
}

/** Ticks the clock runs while the room is paused: whatever they are, the room must ignore them. */
const IGNORED_TICKS = 4;
/** Ticks `debug_step_room` is asked for; deliberately not a whole broadcast interval. */
const STEPPED_TICKS = 2;
/** Ticks the resumed room runs before the tick count is read. */
const RESUMED_TICKS = 2;

describe('pause / step / resume through the room loop', () => {
  it('a paused room ignores the clock, steps exactly on request, and resumes without catching up', async () => {
    const fixture = loopFixture();
    // One broadcast interval of running, so the counts below are the cadence's and not a tick's.
    fixture.advance(SNAPSHOT_EVERY_TICKS);
    expect(fixture.room.getTickCount()).toBe(SNAPSHOT_EVERY_TICKS);
    expect(fixture.snapshotsSentToAlice()).toBe(1);

    await fixture.call('debug_pause_room', { gameId: fixture.gameId });
    fixture.advance(IGNORED_TICKS);
    expect(fixture.room.getTickCount()).toBe(SNAPSHOT_EVERY_TICKS);

    const stepped = await fixture.call('debug_step_room', { gameId: fixture.gameId, ticks: STEPPED_TICKS });
    const tickAfterStep = SNAPSHOT_EVERY_TICKS + STEPPED_TICKS;
    expect(parseToolJson(stepped)).toEqual({ gameId: fixture.gameId, isPaused: true, tick: tickAfterStep });
    // A stepped room always ends on a fresh frame, so a partial interval still costs one broadcast.
    expect(fixture.snapshotsSentToAlice()).toBe(1 + Math.ceil(STEPPED_TICKS / SNAPSHOT_EVERY_TICKS));

    fixture.advance(IGNORED_TICKS);
    await fixture.call('debug_resume_room', { gameId: fixture.gameId });
    fixture.advance(RESUMED_TICKS);
    expect(fixture.room.getTickCount()).toBe(tickAfterStep + RESUMED_TICKS);
    expect(fixture.room.performanceTracker.getStats().droppedTicks).toBe(0);
    fixture.stop();
  });
});
