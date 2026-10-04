// The slime's pocket, the dark past its wall and the drop's skin on the GPU (docs/rendering/opening-dive.md §4, ticket
// #803, the mockup's `drawDish`, the end of `drawMicro` and its edge strokes): the 40 µm pocket of clear water edged
// like the game's wall, handing over to the game's dish as the dark field arrives; the field falling away darker past
// the wall; and the drop's skin seen from inside, near its edge, over everything. GLSL ES 3.00.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import {
  BG_DEEP,
  BG_FIELD,
  CELL_WALL_LIGHT,
  LIGHT_ACCENT,
  WALL_GLASS,
  WALL_GLASS_INNER,
  WALL_GLASS_OUTER,
} from '../../constants';
import { SLIME_DROP_SKIN, SLIME_POCKET, SLIME_POCKET_RADIUS_M } from '../../constants/dive-slime';
import { glslFloat } from '../../cells/cell-shader-source';
import {
  KELP_FRAGMENT_HEAD,
  KELP_PAINT_SOURCE,
  KELP_STOPS_SOURCE,
  KELP_VERTEX_HEAD,
  glslHex,
  glslRgb,
} from '../kelp/kelp-shader-common';
import { SLIME_COMMON_UNIFORM, SLIME_DROP_SOURCE, SLIME_FRAME_SOURCE } from './slime-shader-common';

export const SLIME_POCKET_UNIFORM = {
  /** The mockup's `WALL_LIGHT` is the game's `CELL_WALL_LIGHT`. The glass's ring width, the lit rim's width and the accent arc's width (pocket radii), and the pocket's alpha. */
  pocket: 'uPocket',
  /** A quad's centre (metres) and half its size (metres). */
  quad: 'uQuad',
  /** The skin's bright line's and warm band's widths and the band's inset (metres), and the slime's fade. */
  skin: 'uSkin',
} as const;

const float = glslFloat;
const POCKET = SLIME_POCKET;
const UNIFORM = SLIME_POCKET_UNIFORM;

/** A unit quad scaled round a centre: the pocket's and the skin's. */
export const SLIME_QUAD_VERTEX_SOURCE = /* glsl */ `${KELP_VERTEX_HEAD}
uniform vec4 ${UNIFORM.quad};
in vec2 aPosition;
out vec2 vWorld;

void main() {
  vWorld = ${UNIFORM.quad}.xy + aPosition * ${UNIFORM.quad}.z;
  gl_Position = clipOf(vWorld);
}
`;

const RING = POCKET.ring;
const RIM = POCKET.rim;
const ACCENT = POCKET.accent;

export const SLIME_POCKET_FRAGMENT_SOURCE = /* glsl */ `${KELP_FRAGMENT_HEAD}
uniform vec4 ${UNIFORM.pocket};
in vec2 vWorld;
${KELP_PAINT_SOURCE}${KELP_STOPS_SOURCE}${SLIME_FRAME_SOURCE}${SLIME_DROP_SOURCE}
/** Coverage of a shape whose signed distance (+ inside) is \`radii\` pocket radii. */
float coverRadii(float radii) { return cover(radii * ${float(SLIME_POCKET_RADIUS_M)}); }

vec4 glassRing(float away, float dark, float alpha) {
  float ring = ${UNIFORM.pocket}.x;
  float at = (away - 1.0) / ring;
  vec4 outer = vec4(${glslHex(WALL_GLASS_OUTER)}, ${float(RING.alphas[0].darkField)} * dark + ${float(RING.alphas[0].base)});
  vec4 inner = vec4(${glslHex(WALL_GLASS_INNER)}, ${float(RING.alphas[1].darkField)} * dark + ${float(RING.alphas[1].base)});
  vec4 colour = stops3(outer, inner, vec4(${glslHex(WALL_GLASS)}, 0.0), ${float(RING.stops[1])}, at);
  return colour * coverRadii(away - 1.0) * coverRadii(1.0 + ring - away) * alpha;
}

vec4 litRim(vec2 local, float away, float alpha) {
  float along = clamp((local.x + local.y + 2.0) / 4.0, 0.0, 1.0);
  float light = along < 0.5 ? mix(${float(RIM.stops[0])}, ${float(RIM.stops[1])}, along * 2.0) : mix(${float(RIM.stops[1])}, ${float(RIM.stops[2])}, along * 2.0 - 1.0);
  float width = ${UNIFORM.pocket}.y;
  return paint(${glslHex(CELL_WALL_LIGHT)}, light * alpha) * coverRadii(0.5 * width - abs(away - 1.0));
}

vec4 accentArc(vec2 local, float away, float dark, float alpha) {
  float width = ${UNIFORM.pocket}.z;
  float turn = atan(local.y, local.x);
  if (turn < 0.0) turn += ${float(RADIANS_PER_FULL_TURN)};
  if (turn < ${float(Math.PI * ACCENT.fromTurns)} || turn > ${float(Math.PI * ACCENT.toTurns)}) return vec4(0.0);
  float band = coverRadii(0.5 * width - abs(away - 1.0 - 0.5 * width));
  return paint(${glslHex(LIGHT_ACCENT)}, ${float(ACCENT.alpha)} * dark * alpha) * band;
}

void main() {
  vec2 local = vWorld / ${float(SLIME_POCKET_RADIUS_M)};
  float away = length(local);
  float dark = darkField();
  float alpha = ${UNIFORM.pocket}.w;
  float inDisc = coverRadii(1.0 - away);
  vec4 colour = paint(${glslRgb(POCKET.water.rgb)}, ${float(POCKET.water.alpha)} * alpha * (1.0 - dark)) * inDisc;
  colour = over(colour, paint(${glslHex(BG_FIELD)}, alpha * ${float(POCKET.field.alpha)} * dark) * inDisc);
  colour = over(colour, glassRing(away, dark, alpha));
  float lit = alpha * (${float(RIM.alpha)} + ${float(RIM.darkField)} * dark);
  colour = over(colour, litRim(local, away, lit));
  colour = over(colour, accentArc(local, away, dark, lit));
  fragColour = colour * insideDrop(vWorld);
}
`;

/** Past the pocket's wall the field falls away darker: a quad over the stage, outside the wall's reach. */
export const SLIME_OUTSIDE_FRAGMENT_SOURCE = /* glsl */ `${KELP_FRAGMENT_HEAD}
in vec2 vWorld;
${KELP_PAINT_SOURCE}${SLIME_FRAME_SOURCE}${SLIME_DROP_SOURCE}
void main() {
  float outside = cover(length(vWorld) - ${float(SLIME_POCKET_RADIUS_M * POCKET.outside.reachRadii)});
  fragColour = paint(${glslHex(BG_DEEP)}, darkField() * ${float(POCKET.outside.alpha)}) * outside * insideDrop(vWorld);
}
`;

const SKIN = SLIME_DROP_SKIN;
const DROP = SLIME_COMMON_UNIFORM.drop;

/** The drop's skin from inside: its bright line at the rim, and a warm band just inside it. */
export const SLIME_SKIN_FRAGMENT_SOURCE = /* glsl */ `${KELP_FRAGMENT_HEAD}
uniform vec4 ${UNIFORM.skin};
uniform vec4 ${DROP};
in vec2 vWorld;
${KELP_PAINT_SOURCE}
void main() {
  float away = length(vWorld - ${DROP}.xy);
  float slime = ${UNIFORM.skin}.w;
  vec4 colour = paint(${glslRgb(SKIN.line.rgb)}, ${float(SKIN.line.alpha)} * slime) * stroke(away - ${DROP}.z, ${UNIFORM.skin}.x);
  float band = stroke(away - (${DROP}.z - ${UNIFORM.skin}.z), ${UNIFORM.skin}.y);
  fragColour = over(colour, paint(${glslRgb(SKIN.band.rgb)}, ${float(SKIN.band.alpha)} * slime) * band);
}
`;
