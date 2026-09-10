import { describe, expect, it } from 'vitest';
import { AVATAR_INDEX_MAX, AVATAR_INDEX_MIN } from '@evolution/shared';
import { botStreamLabel, createBotIdentity } from './bot-identity.js';

describe('bot identity', () => {
  it('derives a stable id and name from the swarm seed and the bot index', () => {
    expect(createBotIdentity(42, 0)).toEqual({
      playerId: 'bot_42_0',
      playerName: 'Bot 0',
      avatarIndex: AVATAR_INDEX_MIN,
    });
    expect(createBotIdentity(42, 0)).toEqual(createBotIdentity(42, 0));
  });

  it('never collides across seeds or indices', () => {
    const ids = [createBotIdentity(1, 0), createBotIdentity(1, 1), createBotIdentity(2, 0)].map((bot) => bot.playerId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cycles the avatar through the palette so every seat stays in range', () => {
    const avatarCount = AVATAR_INDEX_MAX - AVATAR_INDEX_MIN + 1;
    expect(createBotIdentity(1, avatarCount).avatarIndex).toBe(AVATAR_INDEX_MIN);
    expect(createBotIdentity(1, avatarCount - 1).avatarIndex).toBe(AVATAR_INDEX_MAX);
  });

  it('labels each bot its own stream by index', () => {
    expect(botStreamLabel(3)).toBe('bot_3');
    expect(botStreamLabel(3)).not.toBe(botStreamLabel(4));
  });
});
