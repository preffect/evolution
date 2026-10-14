// The slime's gel on the GPU (docs/rendering/opening-dive.md §4, ticket #803, the mockup's `drawSlime`): a soft cloud
// on every cell of its world-stable grid, none in the dish, each a quad of its own made once (`slime-scatter.ts`) and
// drawn as the mockup's glow sprite, dimmed as the dark field arrives and clipped to the drop. GLSL ES 3.00.

import { SLIME_CLOUDS, SLIME_PALETTE } from '../../constants/dive-slime';
import { glslFloat } from '../../cells/cell-shader-source';
import { KELP_FRAGMENT_HEAD, KELP_PAINT_SOURCE, KELP_VERTEX_HEAD, glslHex } from '../kelp/kelp-shader-common';
import {
  SLIME_CORNER_ATTRIBUTE,
  SLIME_DROP_SOURCE,
  SLIME_FRAME_SOURCE,
  SLIME_GLOW_SOURCE,
} from './slime-shader-common';

/** Each cloud's centre (metres), radius (metres) and own alpha, on all four of its corners. */
export const SLIME_CLOUD_ATTRIBUTE = 'aCloud';

export const SLIME_CLOUD_VERTEX_SOURCE = /* glsl */ `${KELP_VERTEX_HEAD}
in vec2 ${SLIME_CORNER_ATTRIBUTE};
in vec4 ${SLIME_CLOUD_ATTRIBUTE};
out vec2 vCorner;
out vec2 vWorld;
out float vAlpha;

void main() {
  vCorner = ${SLIME_CORNER_ATTRIBUTE};
  vWorld = ${SLIME_CLOUD_ATTRIBUTE}.xy + ${SLIME_CORNER_ATTRIBUTE} * ${SLIME_CLOUD_ATTRIBUTE}.z;
  vAlpha = ${SLIME_CLOUD_ATTRIBUTE}.w;
  gl_Position = clipOf(vWorld);
}
`;

export const SLIME_CLOUD_FRAGMENT_SOURCE = /* glsl */ `${KELP_FRAGMENT_HEAD}
in vec2 vCorner;
in vec2 vWorld;
in float vAlpha;
${KELP_PAINT_SOURCE}${SLIME_FRAME_SOURCE}${SLIME_DROP_SOURCE}${SLIME_GLOW_SOURCE}
void main() {
  float dim = 1.0 - darkField() * ${glslFloat(SLIME_CLOUDS.darkFieldDim)};
  float alpha = glowAt(length(vCorner)) * vAlpha * dim * slimeAlpha() * insideDrop(vWorld);
  fragColour = paint(${glslHex(SLIME_PALETTE.slime)}, alpha);
}
`;
