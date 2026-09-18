// The eyepiece's furniture as numbers (docs/ui/encyclopedia.md §11.4): the rim, the condenser's inner ring, the
// reticle ticks, the field stop's vignette and the loading ring. `encyclopedia-lens.component.ts` draws these into
// one DOM SVG over the preview canvas and decides nothing itself (§11.7).
//
// **One coordinate system:** a view box `ENCYCLOPEDIA_LENS_DIAMETER_PX` a side, so every length here is a scale-1
// unit and the overlay element — sized in CSS at the diameter × `--ui-scale` — scales the whole drawing with the
// panel. Colours are *not* here: the overlay's stylesheet takes each from its `--ui-…` role, which is the one place
// a colour may be named (components-and-constants.md §10.1). Opacities are, because SVG takes them as attributes
// beside the geometry they belong to, and a token no stylesheet reads has no business being published.

import { pointOnCircle } from '@evolution/shared';
import { UI_RIM_PX } from '../../../ui-kit/ui-kit-constants';
import { DEGREES_PER_TURN, degreesToRadians, HALF } from '../../render/geometry';
import {
  ENCYCLOPEDIA_LENS_DIAMETER_PX,
  ENCYCLOPEDIA_LENS_INNER_RING_ALPHA,
  ENCYCLOPEDIA_LENS_LOADING_RING_RADIUS_FRACTION,
  ENCYCLOPEDIA_LENS_MAJOR_TICK_EVERY,
  ENCYCLOPEDIA_LENS_MAJOR_TICK_PX,
  ENCYCLOPEDIA_LENS_MINOR_TICK_PX,
  ENCYCLOPEDIA_LENS_RIM_PX,
  ENCYCLOPEDIA_LENS_TICK_ALPHA,
  ENCYCLOPEDIA_LENS_TICK_COUNT,
  ENCYCLOPEDIA_LENS_VIGNETTE_ALPHA,
  ENCYCLOPEDIA_LENS_VIGNETTE_START_FRACTION,
} from '../encyclopedia-constants';

/** One reticle tick, as the line the overlay strokes. */
export interface LensTickLine {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface LensOverlayGeometry {
  readonly viewBox: string;
  /** Both coordinates of the centre, and the lens's own radius: the drawing is square and centred. */
  readonly centre: number;
  readonly radius: number;
  /** The rim's stroke centre line and width, so the band it covers is `rimRadius ± rimWidth / 2`. */
  readonly rimRadius: number;
  readonly rimWidth: number;
  /** The condenser's bright edge, immediately inside the rim. */
  readonly innerRingRadius: number;
  readonly innerRingOpacity: number;
  /** The one width every hairline in the overlay is stroked at: the inner ring, the ticks and the loading ring. */
  readonly hairlineWidth: number;
  readonly ticks: readonly LensTickLine[];
  readonly tickOpacity: number;
  /** A gradient stop as a fraction of the lens radius: the vignette is clear inside it and this dark at the rim. */
  readonly vignetteStartOffset: number;
  readonly vignetteOpacity: number;
  /** The `loading` ring, at `ENCYCLOPEDIA_LENS_LOADING_RING_RADIUS_FRACTION` of the radius. */
  readonly loadingRingRadius: number;
}

/**
 * Decimals a coordinate is written with. A tick's ends are cosines, so without this the DOM carries
 * `150.00000000000003` and a spec comparing two of them compares noise.
 */
const COORDINATE_DECIMALS = 3;

/** Twelve o'clock, so the four major ticks land on the quarters rather than between them. */
const FIRST_TICK_DEGREES = -90;

function rounded(value: number): number {
  return Number(value.toFixed(COORDINATE_DECIMALS));
}

/** A tick's length: the majors mark the quarters, the rest are the marks between them. */
export function lensTickLengthAt(index: number): number {
  return index % ENCYCLOPEDIA_LENS_MAJOR_TICK_EVERY === 0
    ? ENCYCLOPEDIA_LENS_MAJOR_TICK_PX
    : ENCYCLOPEDIA_LENS_MINOR_TICK_PX;
}

/**
 * Every tick, in order from twelve o'clock clockwise. Each runs **inward** from the rim's inner edge, so a tick
 * neither disappears under the rim nor reaches the `PREVIEW_LENS_SAFE_RADIUS_FRACTION` circle a subject's body
 * stays inside (§12.7): at a 300 px lens the longest ends at 134 of the 150 unit radius, and 0.8 of it is 120.
 */
function lensTicks(radius: number): readonly LensTickLine[] {
  const centre = radius;
  const outerRadius = radius - ENCYCLOPEDIA_LENS_RIM_PX;
  return Array.from({ length: ENCYCLOPEDIA_LENS_TICK_COUNT }, (_unused, index) => {
    const angle = degreesToRadians(FIRST_TICK_DEGREES + (index / ENCYCLOPEDIA_LENS_TICK_COUNT) * DEGREES_PER_TURN);
    const outer = pointOnCircle(outerRadius, angle);
    const inner = pointOnCircle(outerRadius - lensTickLengthAt(index), angle);
    return {
      x1: rounded(centre + outer.x),
      y1: rounded(centre + outer.y),
      x2: rounded(centre + inner.x),
      y2: rounded(centre + inner.y),
    };
  });
}

/**
 * The whole overlay for a lens of `diameter` scale-1 units. It is called with `ENCYCLOPEDIA_LENS_DIAMETER_PX` and
 * takes the diameter as an argument only so its spec can measure a second size and see that nothing is written
 * against the first.
 *
 * Each ring is stroked inward from the edge it names: the rim's outer edge is the lens's own, and the inner ring
 * sits immediately inside the rim rather than overlapping it.
 */
export function lensOverlayGeometry(diameter: number): LensOverlayGeometry {
  const radius = diameter * HALF;
  return {
    viewBox: `0 0 ${diameter} ${diameter}`,
    centre: radius,
    radius,
    rimRadius: radius - ENCYCLOPEDIA_LENS_RIM_PX * HALF,
    rimWidth: ENCYCLOPEDIA_LENS_RIM_PX,
    innerRingRadius: radius - ENCYCLOPEDIA_LENS_RIM_PX - UI_RIM_PX * HALF,
    innerRingOpacity: ENCYCLOPEDIA_LENS_INNER_RING_ALPHA,
    hairlineWidth: UI_RIM_PX,
    ticks: lensTicks(radius),
    tickOpacity: ENCYCLOPEDIA_LENS_TICK_ALPHA,
    vignetteStartOffset: ENCYCLOPEDIA_LENS_VIGNETTE_START_FRACTION,
    vignetteOpacity: ENCYCLOPEDIA_LENS_VIGNETTE_ALPHA,
    loadingRingRadius: rounded(radius * ENCYCLOPEDIA_LENS_LOADING_RING_RADIUS_FRACTION),
  };
}

/** The one overlay the lens draws, built once: it reads only constants. */
export const ENCYCLOPEDIA_LENS_OVERLAY = lensOverlayGeometry(ENCYCLOPEDIA_LENS_DIAMETER_PX);
