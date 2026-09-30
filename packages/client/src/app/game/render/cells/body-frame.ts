// The form-normalised body frame (docs/rendering/cells.md §2.2, ticket #194 review): the body ramp, the pools, the
// glint and the halo are laid out in the undeformed frame **divided by the form's `B`** at the fragment's angle, so
// they wrap a silhouette that reaches past the unit circle (the spindle's tips at 1.85 r) instead of leaving its
// ends on the ramp's flat last stop. The blob and the amoeba (`B ≡ 1`) are unchanged; the speed stretch, the lobes
// and the clips still reveal the frame beneath, so an amoeba's arm keeps showing cytoplasm. The GLSL twin is
// `frame.pF` / `frame.rhoF` in `cell-shader-patterns.ts`.

import { BODY_RAMP_CENTRE_ANGLE_DEG, BODY_RAMP_CENTRE_OFFSET_RADII, BODY_RAMP_RADIUS_RADII } from '../constants';
import { degreesToRadians, wrapAngle } from '../geometry';
import type { RadialProfileTerms } from './radial-profile';

const RAMP_CENTRE = degreesToRadians(BODY_RAMP_CENTRE_ANGLE_DEG);
const RAMP_CENTRE_X = Math.cos(RAMP_CENTRE) * BODY_RAMP_CENTRE_OFFSET_RADII;
const RAMP_CENTRE_Y = Math.sin(RAMP_CENTRE) * BODY_RAMP_CENTRE_OFFSET_RADII;

/** A point in the body frame, in form-normalised radii. */
export interface BodyFramePoint {
  readonly x: number;
  readonly y: number;
}

/** `r · pulse · B(θ − h)` along the direction of (`x`, `y`): the body frame's unit there, in world units. */
function bodyFrameScale(terms: RadialProfileTerms, x: number, y: number): number {
  const delta = wrapAngle(Math.atan2(y, x) - terms.heading);
  const form = terms.form === null ? 1 : terms.form.evaluate(delta).value;
  return terms.radius * terms.pulse * form;
}

/** The cell-frame point (`x`, `y`, world units) in the body frame: over `r · pulse · B(θ − h)`. */
export function bodyFramePoint(terms: RadialProfileTerms, x: number, y: number): BodyFramePoint {
  const scale = bodyFrameScale(terms, x, y);
  return { x: x / scale, y: y / scale };
}

/**
 * A body-frame point back in the cell frame (world units): times `r · pulse · B` at its own angle, since the body frame
 * keeps the angle. The ribosome speckle places its dots' centres this way and measures their radii in the undeformed
 * frame, so the stipple follows the form and each dot stays round (#767).
 */
export function cellFramePoint(terms: RadialProfileTerms, point: BodyFramePoint): BodyFramePoint {
  const scale = bodyFrameScale(terms, point.x, point.y);
  return { x: point.x * scale, y: point.y * scale };
}

/** The body ramp's `t` at a body-frame point: its distance from the ramp's centre over the ramp's radius. */
export function bodyRampShare(point: BodyFramePoint): number {
  return Math.hypot(point.x - RAMP_CENTRE_X, point.y - RAMP_CENTRE_Y) / BODY_RAMP_RADIUS_RADII;
}
