import { describe, expect, it } from 'vitest';
import { AVATAR_INDEX_MAX, PLAYER_PALETTE_COUNT, SEAT_MARK_BEADS } from '@evolution/shared';
import { seatMarkBeadCount, seatMarkBeadPositions } from './seat-mark';

const SWATCH_RADIUS = 5;

describe('seatMarkBeadCount', () => {
  it('is the shared SEAT_MARK_BEADS entry for every seat, so the swatch matches the cell', () => {
    for (let avatarIndex = 0; avatarIndex <= AVATAR_INDEX_MAX; avatarIndex += 1) {
      expect(seatMarkBeadCount(avatarIndex)).toBe(SEAT_MARK_BEADS[avatarIndex]);
    }
  });

  it('folds an out-of-range index into the seat range rather than answering undefined', () => {
    expect(seatMarkBeadCount(PLAYER_PALETTE_COUNT)).toBe(seatMarkBeadCount(0));
    expect(seatMarkBeadCount(-1)).toBe(seatMarkBeadCount(AVATAR_INDEX_MAX));
  });
});

describe('seatMarkBeadPositions', () => {
  it('puts a lone bead at 12 o’clock', () => {
    const [bead] = seatMarkBeadPositions(1, SWATCH_RADIUS);
    expect(bead?.x).toBeCloseTo(0);
    expect(bead?.y).toBeCloseTo(-SWATCH_RADIUS);
  });

  it('spaces the beads evenly clockwise from the top', () => {
    const [top, right, bottom, left] = seatMarkBeadPositions(4, SWATCH_RADIUS);
    expect([top?.x, top?.y]).toEqual([expect.closeTo(0), expect.closeTo(-SWATCH_RADIUS)]);
    expect([right?.x, right?.y]).toEqual([expect.closeTo(SWATCH_RADIUS), expect.closeTo(0)]);
    expect([bottom?.x, bottom?.y]).toEqual([expect.closeTo(0), expect.closeTo(SWATCH_RADIUS)]);
    expect([left?.x, left?.y]).toEqual([expect.closeTo(-SWATCH_RADIUS), expect.closeTo(0)]);
  });

  it('puts every bead on the swatch outline, for every seat', () => {
    for (let avatarIndex = 0; avatarIndex <= AVATAR_INDEX_MAX; avatarIndex += 1) {
      const beads = seatMarkBeadPositions(seatMarkBeadCount(avatarIndex), SWATCH_RADIUS);
      expect(beads).toHaveLength(seatMarkBeadCount(avatarIndex));
      for (const bead of beads) expect(Math.hypot(bead.x, bead.y)).toBeCloseTo(SWATCH_RADIUS);
    }
  });

  it('answers nothing for a count of none', () => {
    expect(seatMarkBeadPositions(0, SWATCH_RADIUS)).toEqual([]);
  });
});
