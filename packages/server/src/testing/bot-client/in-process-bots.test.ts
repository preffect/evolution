import { describe, expect, it, vi } from 'vitest';
import { playerId } from '@evolution/shared';
import { DebugRequestError } from '../../game/debug/debug-request-error.js';
import { echoBotBinding } from './bot-binding.js';
import { createInProcessBotRoster } from './in-process-bots.js';

const SNAPSHOT = { players: {} };

describe('in-process bot roster', () => {
  it('spawns bots with stable identities in index order and lists them', () => {
    const roster = createInProcessBotRoster(echoBotBinding);
    const first = roster.spawn({ behavior: 'wander', seed: 42 });
    const second = roster.spawn({ behavior: 'idle', seed: 42 });
    expect(first).toEqual({ playerId: 'bot_42_0', playerName: 'Bot 0', avatarIndex: 0, behavior: 'wander' });
    expect(second).toMatchObject({ playerId: 'bot_42_1', behavior: 'idle' });
    expect(roster.list()).toEqual([first, second]);
  });

  it('drives every bot each tick and submits only the inputs the strategies produce', () => {
    const roster = createInProcessBotRoster(echoBotBinding);
    const wanderer = roster.spawn({ behavior: 'wander', seed: 1 });
    roster.spawn({ behavior: 'idle', seed: 1 });
    const submit = vi.fn();
    roster.driveTick(SNAPSHOT, 1, submit);
    roster.driveTick(SNAPSHOT, 2, submit);
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit).toHaveBeenNthCalledWith(1, wanderer.playerId, expect.objectContaining({ sequence: 1 }));
    expect(submit).toHaveBeenNthCalledWith(2, wanderer.playerId, expect.objectContaining({ sequence: 2 }));
  });

  it('drives the same seed to the same inputs on a fresh roster', () => {
    const inputsOf = () => {
      const roster = createInProcessBotRoster(echoBotBinding);
      roster.spawn({ behavior: 'wander', seed: 9 });
      const submit = vi.fn();
      roster.driveTick(SNAPSHOT, 1, submit);
      return submit.mock.calls;
    };
    expect(inputsOf()).toEqual(inputsOf());
  });

  it('removes a bot it spawned and stops driving it', () => {
    const roster = createInProcessBotRoster(echoBotBinding);
    const bot = roster.spawn({ behavior: 'wander', seed: 1 });
    expect(roster.remove(bot.playerId)).toEqual(bot);
    const submit = vi.fn();
    roster.driveTick(SNAPSHOT, 1, submit);
    expect(submit).not.toHaveBeenCalled();
    expect(roster.list()).toEqual([]);
  });

  it('refuses to remove a player it did not spawn', () => {
    const roster = createInProcessBotRoster(echoBotBinding);
    expect(() => roster.remove(playerId('alice'))).toThrow(DebugRequestError);
    expect(() => roster.remove(playerId('alice'))).toThrow(/not a bot spawned in this game/);
  });

  it('refuses an unknown strategy as a debug request error and spawns nothing', () => {
    const roster = createInProcessBotRoster(echoBotBinding);
    expect(() => roster.spawn({ behavior: 'flee', seed: 1 })).toThrow(DebugRequestError);
    expect(() => roster.spawn({ behavior: 'flee', seed: 1 })).toThrow(/idle, wander, grazer, hunter/);
    expect(roster.list()).toEqual([]);
    expect(roster.spawn({ behavior: 'idle', seed: 1 }).playerId).toBe('bot_1_0');
  });
});
