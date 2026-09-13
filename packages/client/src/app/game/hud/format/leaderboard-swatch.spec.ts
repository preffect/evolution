import { describe, expect, it } from 'vitest';
import { AVATAR_INDEX_MAX } from '@evolution/shared';
import { paletteFor } from '../../render/palette';
import { LEADERBOARD_OWN_ROW_TINT_ALPHA } from '../hud-constants';
import { leaderboardSwatchFor } from './leaderboard-swatch';
import { seatMarkBeadCount } from './seat-mark';
import { hexWithAlpha } from './tint';

const SWATCH_RADIUS = 5;

describe('leaderboardSwatchFor', () => {
  it('is the seat’s own palette, so a row and its cell on the dish read as the same player', () => {
    for (let avatarIndex = 0; avatarIndex <= AVATAR_INDEX_MAX; avatarIndex += 1) {
      const swatch = leaderboardSwatchFor(avatarIndex, SWATCH_RADIUS);
      expect(swatch.base).toBe(paletteFor(avatarIndex).base);
      expect(swatch.rim).toBe(paletteFor(avatarIndex).rim);
      expect(swatch.beads).toHaveLength(seatMarkBeadCount(avatarIndex));
    }
  });

  it('tints the own row with its own rim colour at the alpha the style guide sets', () => {
    const swatch = leaderboardSwatchFor(0, SWATCH_RADIUS);
    expect(swatch.ownRowTint).toBe(hexWithAlpha(paletteFor(0).rim, LEADERBOARD_OWN_ROW_TINT_ALPHA));
  });
});

describe('hexWithAlpha', () => {
  it('splits a hex into byte channels at the alpha given', () => {
    expect(hexWithAlpha('#ffffff', 1)).toBe('rgba(255, 255, 255, 1)');
    expect(hexWithAlpha('#000000', 0.12)).toBe('rgba(0, 0, 0, 0.12)');
    expect(hexWithAlpha('#22c1d6', 0.5)).toBe('rgba(34, 193, 214, 0.5)');
  });
});
