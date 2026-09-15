// docs/architecture/wire-contract.md §4.2 lever 3 (#341): the rounding the server applies to a cell on the wire is
// invisible where the camera is closest. Positions and radii arrive at `SNAPSHOT_POSITION_DECIMALS` /
// `SNAPSHOT_RADIUS_DECIMALS`, velocity at `SNAPSHOT_VELOCITY_DECIMALS`; interpolation and extrapolation read them as
// they arrive, so the rounding is the whole error they add.
import { describe, expect, it } from 'vitest';
import {
  CAMERA_MIN_VIEW_HALF_HEIGHT_WU,
  MAX_EXTRAPOLATION_TICKS,
  SNAPSHOT_POSITION_DECIMALS,
  SNAPSHOT_RADIUS_DECIMALS,
  SNAPSHOT_VELOCITY_DECIMALS,
  TICK_INTERVAL_S,
} from '@evolution/shared';
import { zoomFor } from '../render/camera';
import { CAMERA_REFERENCE_VIEWPORT_HEIGHT_PX } from '../render/constants/world-render';

const DECIMAL_BASE = 10;
const HALF = 0.5;
/** The bar: a fifth of a CSS pixel is below what antialiasing of a moving rim can show. */
const INVISIBLE_ERROR_PX = 0.2;

/** The furthest a value rounded to `decimals` places can be from the exact one. */
function worstRoundingError(decimals: number): number {
  return DECIMAL_BASE ** -decimals * HALF;
}

/** CSS px per wu with the camera at its smallest view, on the reference viewport. */
const closestZoom = zoomFor(
  { x: 0, y: 0, viewHalfHeightWu: CAMERA_MIN_VIEW_HALF_HEIGHT_WU },
  { width: CAMERA_REFERENCE_VIEWPORT_HEIGHT_PX, height: CAMERA_REFERENCE_VIEWPORT_HEIGHT_PX },
);

describe('wire precision at the closest zoom (#341)', () => {
  it('moves a cell’s rim by under a fifth of a CSS pixel: its centre and its radius rounded the wrong way together', () => {
    const rimErrorWu = worstRoundingError(SNAPSHOT_POSITION_DECIMALS) + worstRoundingError(SNAPSHOT_RADIUS_DECIMALS);
    expect(rimErrorWu * closestZoom).toBeLessThan(INVISIBLE_ERROR_PX);
  });

  it('adds less drift than the position rounding over the whole extrapolation cap', () => {
    const driftWu = worstRoundingError(SNAPSHOT_VELOCITY_DECIMALS) * MAX_EXTRAPOLATION_TICKS * TICK_INTERVAL_S;
    expect(driftWu).toBeLessThan(worstRoundingError(SNAPSHOT_POSITION_DECIMALS));
    expect(driftWu * closestZoom).toBeLessThan(INVISIBLE_ERROR_PX);
  });
});
