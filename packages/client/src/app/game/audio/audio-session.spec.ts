// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BALANCE, gameId, playerId, type GameId } from '@evolution/shared';
import type { AudioHooksHandle } from './audio-hooks';
import { AudioSession } from './audio-session';
import type { TransitionOptions } from '../state/snapshot-transitions';

const ROOM = gameId('room-a');
const OWN = playerId('own');
const ROUND_SECONDS = 600;

function options(overrides: Partial<TransitionOptions> = {}): TransitionOptions {
  return { ownPlayerId: OWN, balance: DEFAULT_BALANCE, roundDurationSeconds: ROUND_SECONDS, ...overrides };
}

function fakeHandle(): AudioHooksHandle {
  return { ready: Promise.resolve(), observe: vi.fn(), updateOptions: vi.fn(), unlock: vi.fn(), disconnect: vi.fn() };
}

function sessionWithHandles() {
  const handles: AudioHooksHandle[] = [];
  const connect = vi.fn(() => {
    const handle = fakeHandle();
    handles.push(handle);
    return handle;
  });
  return { session: new AudioSession(connect), connect, handles };
}

describe('AudioSession (#275)', () => {
  it('connects on the first game_state and keeps that session through a resync, taking only its balance', () => {
    const { session, connect, handles } = sessionWithHandles();
    session.begin(ROOM, options());
    const patched = { ...DEFAULT_BALANCE };
    session.begin(ROOM, options({ balance: patched }));
    expect(connect).toHaveBeenCalledTimes(1);
    expect(handles[0]!.disconnect).not.toHaveBeenCalled();
    expect(handles[0]!.updateOptions).toHaveBeenCalledWith({ balance: patched });
  });

  it.each<[string, GameId, TransitionOptions]>([
    ['another room, same player and round length', gameId('room-b'), options()],
    ['another player in the same room', ROOM, options({ ownPlayerId: playerId('other') })],
  ])('starts over for %s', (_label, nextRoom, next) => {
    const { session, connect, handles } = sessionWithHandles();
    session.begin(ROOM, options());
    session.begin(nextRoom, next);
    expect(connect).toHaveBeenCalledTimes(2);
    expect(handles[0]!.disconnect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenLastCalledWith(next);
  });

  it('forwards observe, updateOptions and unlock to the live handle, and nothing before one exists', () => {
    const { session, handles } = sessionWithHandles();
    session.observe({} as never);
    session.unlock();
    session.updateOptions({ balance: DEFAULT_BALANCE });
    session.begin(ROOM, options());
    const handle = handles[0]!;
    session.observe({} as never);
    session.unlock();
    const patched = { ...DEFAULT_BALANCE };
    session.updateOptions({ balance: patched });
    expect([vi.mocked(handle.observe).mock.calls.length, vi.mocked(handle.unlock).mock.calls.length]).toEqual([1, 1]);
    expect(handle.updateOptions).toHaveBeenCalledWith({ balance: patched });
  });

  it('disconnects for good: the next game_state, even for the same room, connects a new session', () => {
    const { session, connect, handles } = sessionWithHandles();
    session.begin(ROOM, options());
    session.disconnect();
    session.disconnect();
    expect(handles[0]!.disconnect).toHaveBeenCalledTimes(1);
    session.begin(ROOM, options());
    expect(connect).toHaveBeenCalledTimes(2);
  });
});
