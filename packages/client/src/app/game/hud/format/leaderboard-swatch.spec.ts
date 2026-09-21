// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AVATAR_INDEX_MAX } from '@evolution/shared';
import { paletteFor } from '../../render/palette';
import {
  LEADERBOARD_OWN_ROW_TINT_ALPHA,
  LEADERBOARD_SWATCH_BEAD_DIAMETER_PX,
  LEADERBOARD_SWATCH_DIAMETER_PX,
  LEADERBOARD_SWATCH_RING_WIDTH_PX,
} from '../hud-constants';
import { leaderboardSwatchFor, leaderboardSwatchGeometry } from './leaderboard-swatch';
import { seatMarkBeadCount } from './seat-mark';
import { hexWithAlpha } from './tint';

const SWATCH_RADIUS = 5;

describe('leaderboardSwatchGeometry', () => {
  // The regression this pins: a viewBox wider than the element halves every constant inside the
  // SVG, and a 1.5 px bead antialiases into the rim — the exact failure the bead size exists to
  // avoid. Nothing about that is visible in a stylesheet or in the markup on its own.
  it('draws one user unit per CSS pixel, so a constant means on screen what it says', () => {
    expect(leaderboardSwatchGeometry().pxPerUserUnit).toBe(1);
  });

  it('gives the viewBox the disc’s own bounds, centred on the origin', () => {
    const geometry = leaderboardSwatchGeometry();
    expect(geometry.viewBoxSideUnits).toBe(LEADERBOARD_SWATCH_DIAMETER_PX);
    expect(geometry.renderedSidePx).toBe(LEADERBOARD_SWATCH_DIAMETER_PX);
    expect(geometry.viewBox).toBe('-5 -5 10 10');
  });

  it('reaches the screen at the sizes §3.1.1 and the constants set', () => {
    const geometry = leaderboardSwatchGeometry();
    const pixels = (userUnits: number): number => userUnits * geometry.pxPerUserUnit;
    expect(pixels(geometry.bodyRadius * 2)).toBe(LEADERBOARD_SWATCH_DIAMETER_PX);
    expect(pixels(geometry.beadRadius * 2)).toBe(LEADERBOARD_SWATCH_BEAD_DIAMETER_PX);
    expect(pixels(geometry.ringWidth)).toBe(LEADERBOARD_SWATCH_RING_WIDTH_PX);
  });
});

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
