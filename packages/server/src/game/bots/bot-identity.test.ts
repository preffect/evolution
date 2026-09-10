import { describe, expect, it } from 'vitest';
import { AVATAR_INDEX_MAX, AVATAR_INDEX_MIN } from '@evolution/shared';
import { BOT_ID_PREFIX, botStreamLabel, createBotIdentity } from './bot-identity.js';

describe('bot identity', () => {
  it('derives a stable id and name from the host, the seed and the bot index', () => {
    expect(createBotIdentity('wire', 42, 0)).toEqual({
      playerId: 'bot_42_0',
      playerName: 'Bot 0',
      avatarIndex: AVATAR_INDEX_MIN,
    });
    expect(createBotIdentity('inProcess', 42, 0)).toEqual({
      playerId: 'sim_bot_42_0',
      playerName: 'Bot 0',
      avatarIndex: AVATAR_INDEX_MIN,
    });
    expect(createBotIdentity('wire', 42, 0)).toEqual(createBotIdentity('wire', 42, 0));
  });

  it('never collides across seeds or indices', () => {
    const ids = [createBotIdentity('wire', 1, 0), createBotIdentity('wire', 1, 1), createBotIdentity('wire', 2, 0)].map(
      (bot) => bot.playerId,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives the wire client and the in-process roster ids that can never coincide, even from one seed', () => {
    expect(BOT_ID_PREFIX.wire).not.toBe(BOT_ID_PREFIX.inProcess);
    expect(createBotIdentity('wire', 1, 0).playerId).not.toBe(createBotIdentity('inProcess', 1, 0).playerId);
    expect(createBotIdentity('inProcess', 1, 0).playerId.startsWith(BOT_ID_PREFIX.wire)).toBe(false);
  });

  it('cycles the avatar through the palette so every seat stays in range', () => {
    const avatarCount = AVATAR_INDEX_MAX - AVATAR_INDEX_MIN + 1;
    expect(createBotIdentity('wire', 1, avatarCount).avatarIndex).toBe(AVATAR_INDEX_MIN);
    expect(createBotIdentity('wire', 1, avatarCount - 1).avatarIndex).toBe(AVATAR_INDEX_MAX);
  });

  it('labels each bot its own stream by index', () => {
    expect(botStreamLabel(3)).toBe('bot_3');
    expect(botStreamLabel(3)).not.toBe(botStreamLabel(4));
  });
});
