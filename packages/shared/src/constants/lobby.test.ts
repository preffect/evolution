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
  PLAYER_PALETTE_COUNT,
  SEAT_MARK_BEADS,
  wrapAvatarIndex,
} from './lobby.js';

/** docs/visual-style/principles-and-palette.md §2: eight palettes, so the last avatar index is 7. */
const LAST_AVATAR_INDEX = 7;

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

  it('derives the avatar index range from the palette count, one palette per seat', () => {
    expect(PLAYER_PALETTE_COUNT).toBe(MAX_PLAYERS_PER_GAME);
    expect(AVATAR_INDEX_MAX).toBe(PLAYER_PALETTE_COUNT - 1);
    expect(AVATAR_INDEX_MAX).toBe(LAST_AVATAR_INDEX);
  });

  it('marks seat N with N + 1 beads, one entry per avatar index', () => {
    expect(SEAT_MARK_BEADS).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(SEAT_MARK_BEADS).toHaveLength(AVATAR_INDEX_MAX + 1);
  });

  it('folds any avatar index into the seat range, so a palette and a bead count always exist', () => {
    expect(wrapAvatarIndex(0)).toBe(0);
    expect(wrapAvatarIndex(AVATAR_INDEX_MAX)).toBe(AVATAR_INDEX_MAX);
    expect(wrapAvatarIndex(PLAYER_PALETTE_COUNT)).toBe(0);
    expect(wrapAvatarIndex(PLAYER_PALETTE_COUNT + 3)).toBe(3);
    expect(wrapAvatarIndex(-1)).toBe(AVATAR_INDEX_MAX);
  });
});
