// Where the nearest threat's label sits (docs/RENDERING.md §10, docs/UI.md §3.1.2): on the
// predator's warning ring, `THREAT_LABEL_GAP_PX` off it on the side that faces the own cell, and
// on the far side of the ring instead when that pill would cross the own cell's orbit extent, so
// the label never covers the counters or the numeral. Pure, in screen px; the text is always upright.

import type { ScreenPoint } from '../camera';
import { LABEL_PILL_HEIGHT_PX, THREAT_LABEL_GAP_PX } from '../constants';
import { HALF, boxIntersectsDisc } from '../geometry';
import { ladderOrbitExtentPx } from './own-cell-geometry';

export interface ThreatLabelInput {
  readonly threatCentre: ScreenPoint;
  /** The warning ring the renderer draws on that threat (`warningRingPxFor`). */
  readonly warningRingPx: number;
  readonly ownCentre: ScreenPoint;
  /** The own cell's on-screen radius, `r_px`. */
  readonly ownRadiusPx: number;
  /** The whole pill: the measured label text plus `LABEL_PILL_PAD_PX` at each end. */
  readonly pillWidthPx: number;
}

export interface ThreatLabelPlacement {
  /** The pill's centre. */
  readonly x: number;
  readonly y: number;
  readonly isFarSide: boolean;
  /** Always `UPRIGHT`: the label never turns with the direction it sits in. */
  readonly rotation: number;
}

export const UPRIGHT = 0;

/** Straight up: the side a label takes when a threat's centre sits exactly on the own cell's. */
const COINCIDENT_DIRECTION: ScreenPoint = { x: 0, y: -1 };

function unitDirection(from: ScreenPoint, target: ScreenPoint): ScreenPoint {
  const deltaX = target.x - from.x;
  const deltaY = target.y - from.y;
  const length = Math.hypot(deltaX, deltaY);
  return length === 0 ? COINCIDENT_DIRECTION : { x: deltaX / length, y: deltaY / length };
}

export function threatLabelPlacement(input: ThreatLabelInput): ThreatLabelPlacement {
  const { threatCentre, ownCentre } = input;
  const toward = unitDirection(threatCentre, ownCentre);
  const offsetPx = input.warningRingPx + THREAT_LABEL_GAP_PX + LABEL_PILL_HEIGHT_PX * HALF;
  const nearSide = { x: threatCentre.x + toward.x * offsetPx, y: threatCentre.y + toward.y * offsetPx };
  const isCrossingOrbit = boxIntersectsDisc(
    { ...nearSide, halfWidth: input.pillWidthPx * HALF, halfHeight: LABEL_PILL_HEIGHT_PX * HALF },
    { ...ownCentre, radius: ladderOrbitExtentPx(input.ownRadiusPx) },
  );
  if (!isCrossingOrbit) return { ...nearSide, isFarSide: false, rotation: UPRIGHT };
  return {
    x: threatCentre.x - toward.x * offsetPx,
    y: threatCentre.y - toward.y * offsetPx,
    isFarSide: true,
    rotation: UPRIGHT,
  };
}
