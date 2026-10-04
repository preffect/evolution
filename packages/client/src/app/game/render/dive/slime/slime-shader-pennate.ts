// The two big pennate diatoms among the plankton on the GPU (docs/rendering/opening-dive.md §4, ticket #803, the
// mockup's `pennate(o, df)` for `ORGS`): a quad round each, its picture the rung of its ladder for its size on screen
// in bright field and in dark field, mixed by the dark field as the game's dish arrives (the one the label calls
// bigger than the dish is in view through the whole handoff). Until its ladders bake it is drawn as its glass box's
// outline, filled and rimmed (a scrub can get there first), so its label points at a diatom. Its halo is a sprite of
// its own. GLSL ES 3.00.

import { SILICA_BASE, SILICA_LIGHT } from '../../constants';
import { SLIME_LANCEOLATE, SLIME_LINE_MIN_PX, SLIME_PENNATE } from '../../constants/dive-slime-diatoms';
import { glslFloat } from '../../cells/cell-shader-source';
import { HALF } from '../../geometry';
import {
  KELP_COMMON_UNIFORM,
  KELP_FRAGMENT_HEAD,
  KELP_PAINT_SOURCE,
  KELP_TURN_SOURCE,
  KELP_VERTEX_HEAD,
  glslHex,
} from '../kelp/kelp-shader-common';
import { SLIME_FRAME_SOURCE } from './slime-shader-common';

export const SLIME_PENNATE_UNIFORM = {
  /** Its centre and length (metres), and its heading. */
  pennate: 'uPennate',
  /** The box its rung was drawn in, in its unit. */
  box: 'uPennateBox',
  /** How far its quad reaches round its centre, in its unit, and 1 once its pictures are bound. */
  reach: 'uPennateReach',
  bright: 'uPennateBright',
  dark: 'uPennateDark',
} as const;

const UNIFORM = SLIME_PENNATE_UNIFORM;
const VIEW = KELP_COMMON_UNIFORM.view;
const float = glslFloat;
const LOOK = SLIME_PENNATE;

export const SLIME_PENNATE_VERTEX_SOURCE = /* glsl */ `${KELP_VERTEX_HEAD}
uniform vec4 ${UNIFORM.pennate};
uniform vec4 ${UNIFORM.reach};
in vec2 aPosition;
out vec2 vLocal;
${KELP_TURN_SOURCE}
void main() {
  vLocal = aPosition * ${UNIFORM.reach}.x;
  vec2 world = ${UNIFORM.pennate}.xy + turn(vLocal * ${UNIFORM.pennate}.z, ${UNIFORM.pennate}.w);
  gl_Position = clipOf(world);
}
`;

export const SLIME_PENNATE_FRAGMENT_SOURCE = /* glsl */ `${KELP_FRAGMENT_HEAD}
uniform vec4 ${UNIFORM.pennate};
uniform vec4 ${UNIFORM.box};
uniform vec4 ${UNIFORM.reach};
uniform sampler2D ${UNIFORM.bright};
uniform sampler2D ${UNIFORM.dark};
in vec2 vLocal;
${KELP_PAINT_SOURCE}${SLIME_FRAME_SOURCE}
/** Its glass box's outline, filled and rimmed: what stands in until its pictures bake. */
vec4 outline(vec2 local) {
  float along = clamp(abs(local.x) / ${float(HALF)}, 0.0, 1.0);
  float halfWidth = ${float(LOOK.width * HALF)} * pow(1.0 - along * along, ${float(SLIME_LANCEOLATE.power)});
  float unitPx = ${UNIFORM.pennate}.z * ${VIEW}.z * ${VIEW}.w;
  float insidePx = min(halfWidth - abs(local.y), ${float(HALF)} - abs(local.x)) * unitPx;
  float fill = clamp(insidePx + 0.5, 0.0, 1.0);
  float rim = clamp(${float(SLIME_LINE_MIN_PX * HALF)} * ${VIEW}.w - abs(insidePx) + 0.5, 0.0, 1.0);
  vec4 colour = paint(${glslHex(SILICA_BASE)}, (${float(LOOK.fill.base)} + ${float(LOOK.fill.darkField)} * darkField()) * fill);
  return over(colour, paint(${glslHex(SILICA_LIGHT)}, rim));
}

void main() {
  vec4 box = ${UNIFORM.box};
  vec2 at = (vLocal - box.xy) / (box.zw - box.xy);
  if (any(lessThan(at, vec2(0.0))) || any(greaterThan(at, vec2(1.0)))) discard;
  vec4 colour = ${UNIFORM.reach}.y > 0.5
    ? mix(texture(${UNIFORM.bright}, at), texture(${UNIFORM.dark}, at), darkField())
    : outline(vLocal);
  fragColour = colour * slimeAlpha();
}
`;
