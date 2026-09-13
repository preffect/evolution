// The leaderboard swatch's seat mark (docs/UI.md §3.1.1, docs/VISUAL-STYLE.md §2): the palette base
// with a rim-colour ring and `SEAT_MARK_BEADS[avatarIndex]` beads, so a player can match a row to
// the cell on the dish. The bead count is the shared constant the renderer's seat mark reads; only
// the swatch's geometry is this file's, and it is pure so it is tested without a DOM.

import { RADIANS_PER_FULL_TURN, SEAT_MARK_BEADS, wrapAvatarIndex } from '@evolution/shared';

const QUARTER_TURNS_PER_FULL_TURN = 4;
/** Angles are clockwise from 12 o'clock (docs/UI.md §3.1.2), so the first bead sits at the top. */
const FIRST_BEAD_ANGLE_RADIANS = -RADIANS_PER_FULL_TURN / QUARTER_TURNS_PER_FULL_TURN;

export interface SeatMarkBead {
  /** Offset from the swatch centre, in the same units as the radius passed in. */
  readonly x: number;
  readonly y: number;
}

/** `SEAT_MARK_BEADS[avatarIndex]`, with an out-of-range index folded into the seat range. */
export function seatMarkBeadCount(avatarIndex: number): number {
  return SEAT_MARK_BEADS[wrapAvatarIndex(avatarIndex)]!;
}

/**
 * The bead centres for one swatch: `count` points evenly spaced around a circle of `radius`,
 * the first at 12 o'clock and the rest clockwise from it. A single bead is the top one.
 */
export function seatMarkBeadPositions(beadCount: number, radius: number): readonly SeatMarkBead[] {
  return Array.from({ length: Math.max(0, Math.floor(beadCount)) }, (_unused, beadIndex) => {
    const angle = FIRST_BEAD_ANGLE_RADIANS + (RADIANS_PER_FULL_TURN * beadIndex) / beadCount;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });
}
