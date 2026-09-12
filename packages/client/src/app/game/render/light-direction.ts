// The one light direction (docs/VISUAL-STYLE.md §1, docs/RENDERING.md §2.2) in radians, and the
// vectors every module derives from it: the unit vector toward the light and the nucleus rest slot
// (`NUCLEUS_OFFSET_TOWARD_LIGHT` along it, cell frame, fractions of `r`, RENDERING §3). Derived
// once here so the shader bands, the membrane pass, the organelle layout and the ghost agree.

import { LIGHT_DIRECTION_DEG, NUCLEUS_OFFSET_TOWARD_LIGHT } from './constants';
import { degreesToRadians } from './geometry';

export const LIGHT_DIRECTION_RADIANS = degreesToRadians(LIGHT_DIRECTION_DEG);

export const LIGHT_UNIT_VECTOR = {
  x: Math.cos(LIGHT_DIRECTION_RADIANS),
  y: Math.sin(LIGHT_DIRECTION_RADIANS),
} as const;

/** Where the nucleus rests: toward the light by `NUCLEUS_OFFSET_TOWARD_LIGHT` (sheet 01; a ghost's nucleus disc sits here). */
export const NUCLEUS_REST_OFFSET = {
  x: LIGHT_UNIT_VECTOR.x * NUCLEUS_OFFSET_TOWARD_LIGHT,
  y: LIGHT_UNIT_VECTOR.y * NUCLEUS_OFFSET_TOWARD_LIGHT,
} as const;
