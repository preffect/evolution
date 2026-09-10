import { describe, expect, it } from 'vitest';
import {
  AVATAR_INDEX_MAX,
  AVATAR_INDEX_MIN,
  DEFAULT_PLAYERS_PER_GAME,
  GAME_ID_LENGTH,
  GAME_ID_MIN_LENGTH,
  GAME_NAME_MAX_LENGTH,
  GAME_NAME_MIN_LENGTH,
  MAX_PLAYERS_PER_GAME,
  MIN_PLAYERS_PER_GAME,
  PLAYER_NAME_MAX_LENGTH,
  PLAYER_NAME_MIN_LENGTH,
} from './lobby.js';

describe('lobby constants', () => {
  it('orders every min/max pair', () => {
    expect(PLAYER_NAME_MIN_LENGTH).toBeLessThanOrEqual(PLAYER_NAME_MAX_LENGTH);
    expect(GAME_NAME_MIN_LENGTH).toBeLessThanOrEqual(GAME_NAME_MAX_LENGTH);
    expect(AVATAR_INDEX_MIN).toBeLessThanOrEqual(AVATAR_INDEX_MAX);
    expect(MIN_PLAYERS_PER_GAME).toBeLessThanOrEqual(MAX_PLAYERS_PER_GAME);
  });

  it('proposes a default player count inside the allowed range', () => {
    expect(DEFAULT_PLAYERS_PER_GAME).toBeGreaterThanOrEqual(MIN_PLAYERS_PER_GAME);
    expect(DEFAULT_PLAYERS_PER_GAME).toBeLessThanOrEqual(MAX_PLAYERS_PER_GAME);
  });

  it('mints game ids the schema accepts', () => {
    expect(GAME_ID_LENGTH).toBeGreaterThanOrEqual(GAME_ID_MIN_LENGTH);
  });
});
