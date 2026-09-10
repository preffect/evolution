import { describe, expect, it } from 'vitest';
import { registerRoomLoopTools } from './room-loop.js';
import { createActiveRoomFixture, parseToolJson } from '../../testing/builders.js';

function fixtureWithLoopTools() {
  const fixture = createActiveRoomFixture();
  registerRoomLoopTools(fixture.mcp, fixture.context);
  return fixture;
}

describe('room loop tools', () => {
  it('debug_pause_room freezes the loop and reports the state', async () => {
    const fixture = fixtureWithLoopTools();
    const result = await fixture.call('debug_pause_room', { gameId: fixture.gameId });
    expect(parseToolJson(result)).toEqual({ gameId: fixture.gameId, isPaused: true, tick: 0 });
    expect(fixture.room.isPaused()).toBe(true);
    fixture.stop();
  });

  it('debug_step_room advances the room by the given ticks', async () => {
    const fixture = fixtureWithLoopTools();
    const result = await fixture.call('debug_step_room', { gameId: fixture.gameId, ticks: 3 });
    expect(parseToolJson(result)).toEqual({ gameId: fixture.gameId, isPaused: true, tick: 3 });
    fixture.stop();
  });

  it('debug_resume_room unfreezes the loop', async () => {
    const fixture = fixtureWithLoopTools();
    fixture.room.pause();
    const result = await fixture.call('debug_resume_room', { gameId: fixture.gameId });
    expect(parseToolJson(result)).toEqual({ gameId: fixture.gameId, isPaused: false, tick: 0 });
    fixture.stop();
  });

  it.each(['debug_pause_room', 'debug_step_room', 'debug_resume_room'])(
    '%s is an error for an unknown game',
    async (tool) => {
      const fixture = fixtureWithLoopTools();
      expect((await fixture.call(tool, { gameId: 'nope', ticks: 1 })).isError).toBe(true);
      fixture.stop();
    },
  );
});
