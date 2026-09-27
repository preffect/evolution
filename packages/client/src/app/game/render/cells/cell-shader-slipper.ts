// The paramecium's slipper in GLSL (#193; docs/rendering/cells.md §2.4): `slipper-profile.ts` term for term, the
// tier's aspect and area scale baked in from `SLIPPER_SHAPES`. Spliced into the profile helpers before `formAt`.

import {
  SLIPPER_FRONT_BLUNTNESS,
  SLIPPER_ORAL_GROOVE_DEG,
  SLIPPER_ORAL_GROOVE_DEPTH,
  SLIPPER_ORAL_GROOVE_SIGMA_DEG,
} from '../constants';
import { degreesToRadians } from '../geometry';
import { glslFloat } from './cell-shader-source';
import { SLIPPER_SHAPES, type SlipperShape } from './forms/slipper-profile';

const GROOVE_SIGMA = degreesToRadians(SLIPPER_ORAL_GROOVE_SIGMA_DEG);
/** The tier boundaries the shape table switches on: tier `n` covers `(n − ½, n + ½)`. */
const TIER_II_FROM = 1.5;
const TIER_III_FROM = 2.5;
const [TIER_I, TIER_II, TIER_III] = SLIPPER_SHAPES as [SlipperShape, SlipperShape, SlipperShape];

const shapeLiteral = (shape: SlipperShape): string => `vec2(${glslFloat(shape.aspect)}, ${glslFloat(shape.areaScale)})`;

export const CELL_SHADER_SLIPPER = /* glsl */ `
/** The slipper's (aspect, area scale) at 'tier' (slipper-profile.ts SLIPPER_SHAPES). */
vec2 slipperShape(float tier) {
  if (tier < ${glslFloat(TIER_II_FROM)}) return ${shapeLiteral(TIER_I)};
  if (tier < ${glslFloat(TIER_III_FROM)}) return ${shapeLiteral(TIER_II)};
  return ${shapeLiteral(TIER_III)};
}

/** The slipper's 'B(Δ)' with dB/dΔ: ellipse × blunt front × oral groove, at unit area (slipper-profile.ts). */
vec2 slipperAt(float tier, float delta) {
  vec2 shape = slipperShape(tier);
  float aspect = shape.x;
  float c = cos(delta);
  float s = sin(delta);
  float ellipse = inversesqrt(c * c / aspect + aspect * s * s);
  float ellipseD = -ellipse * ellipse * ellipse * s * c * (aspect - 1.0 / aspect);
  float front = 1.0 + ${glslFloat(SLIPPER_FRONT_BLUNTNESS)} * c;
  float frontD = -${glslFloat(SLIPPER_FRONT_BLUNTNESS)} * s;
  float away = wrapAngle(delta - ${glslFloat(degreesToRadians(SLIPPER_ORAL_GROOVE_DEG))});
  float sigmaSquared = ${glslFloat(GROOVE_SIGMA * GROOVE_SIGMA)};
  float notch = ${glslFloat(SLIPPER_ORAL_GROOVE_DEPTH)} * exp(-(away * away) / (2.0 * sigmaSquared));
  float notchD = -notch * away / sigmaSquared;
  float groove = 1.0 - notch;
  return shape.y * vec2(ellipse * front * groove, ellipseD * front * groove + ellipse * frontD * groove - ellipse * front * notchD);
}
`;
