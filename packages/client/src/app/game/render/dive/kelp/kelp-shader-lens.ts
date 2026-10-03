// The spray beads and the drop on the GPU (docs/rendering/opening-dive.md §4, ticket #802, the mockup's `bead`,
// `dropSprite` and `lens`): a quad round each, in the order the mockup draws them, the drop last. A bead a few pixels
// across is the small look (a soft shadow, a clear body darkening to a bright rim, the caustic and two lights); a big
// one, and the drop always, is a lens: the blade floor magnified about its centre (refraction, done here per pixel),
// the water's tint, the caustic the light gathers into (added), the sky window and its glint, and the rim. Sinking
// into the drop relaxes its magnification and fades its surface lights. GLSL ES 3.00.

import { KELP_BEAD_LOOK, KELP_BEADS, KELP_DROP, KELP_LENS_LOOK } from '../../constants/dive-kelp-drop';
import { CHANNEL_MAX } from '../../colour';
import { glslFloat } from '../../cells/cell-shader-source';
import { KELP_BLADE_FLOOR_SOURCE, KELP_FLOOR_UNIFORM } from './kelp-shader-floor';
import {
  KELP_COMMON_UNIFORM as COMMON,
  KELP_FRAGMENT_HEAD,
  KELP_OCTAVE_SOURCE,
  KELP_PAINT_SOURCE,
  KELP_STOPS_SOURCE,
  KELP_VERTEX_HEAD,
  glslRgb,
  glslRgba,
  glslVec2,
} from './kelp-shader-common';

export const KELP_LENS_UNIFORM = {
  /** Whether the beads and the drop draw (1 or 0), and how far the camera is inside the drop. */
  lens: 'uLens',
  bladeTile: KELP_FLOOR_UNIFORM.bladeTile,
} as const;

export const KELP_LENS_ATTRIBUTE = {
  position: 'aPosition',
  /** The lens's centre and radius (metres), and 1 for the drop. */
  lens: 'aLens',
} as const;

const UNIFORM = KELP_LENS_UNIFORM;
const ATTRIBUTE = KELP_LENS_ATTRIBUTE;
const BEAD = KELP_BEAD_LOOK;
const LENS = KELP_LENS_LOOK;
const float = glslFloat;

export const KELP_LENS_VERTEX_SOURCE = /* glsl */ `${KELP_VERTEX_HEAD}
in vec2 ${ATTRIBUTE.position};
in vec4 ${ATTRIBUTE.lens};
out vec2 vWorld;
out vec4 vLens;

void main() {
  vWorld = ${ATTRIBUTE.position};
  vLens = ${ATTRIBUTE.lens};
  gl_Position = clipOf(${ATTRIBUTE.position});
}
`;

/** The stops a `stops5` list holds: a shorter list repeats its last. */
const STOP_SLOTS = 5;

/** A stops list of up to five, and a disc and an ellipse in a lens's unit. */
const UNIT_SOURCE = /* glsl */ `
vec4 stops5(vec4 colours[${STOP_SLOTS}], float at[${STOP_SLOTS}], int count, float t) {
  float clamped = clamp(t, 0.0, 1.0);
  for (int stop = 1; stop < ${STOP_SLOTS}; stop++) {
    if (stop >= count) break;
    if (clamped <= at[stop]) return premultiplied(mix(colours[stop - 1], colours[stop], (clamped - at[stop - 1]) / max(at[stop] - at[stop - 1], 1e-6)));
  }
  return premultiplied(colours[count - 1]);
}
float unitDisc(vec2 point, vec2 centre, float radius, float unitPx) {
  return clamp((radius - length(point - centre)) * unitPx + 0.5, 0.0, 1.0);
}
float unitEllipse(vec2 point, vec2 centre, vec2 radii, float angle, float unitPx) {
  vec2 local = turn(point - centre, -angle) / radii;
  return clamp((1.0 - length(local)) * min(radii.x, radii.y) * unitPx + 0.5, 0.0, 1.0);
}
`;

const slots = (count: number): number[] =>
  Array.from({ length: STOP_SLOTS }, (_unused, index) => Math.min(index, count - 1));

function colours(list: readonly (readonly number[])[], alphas: readonly number[]): string {
  const vectors = slots(list.length).map((index) => glslRgba(list[index] ?? [], alphas[index] ?? 0));
  return `vec4[${STOP_SLOTS}](${vectors.join(', ')})`;
}

function stops(positions: readonly number[]): string {
  return `float[${STOP_SLOTS}](${slots(positions.length)
    .map((index) => float(positions[index] ?? 1))
    .join(', ')})`;
}

const SPRITE_SOURCE = /* glsl */ `
vec4 beadSprite(vec2 point, float unitPx) {
  vec4 colour = paint(${glslRgb(BEAD.shadow.colour)}, ${float(BEAD.shadow.alpha)} * unitEllipse(point, ${glslVec2(BEAD.shadow.x, BEAD.shadow.y)}, ${glslVec2(BEAD.shadow.radiusX, BEAD.shadow.radiusY)}, 0.0, unitPx));
  float body = unitDisc(point, vec2(0.0), 1.0, unitPx);
  float t = (length(point) - ${float(BEAD.body.inner)}) / ${float(1 - BEAD.body.inner)};
  colour = over(colour, stops5(${colours(BEAD.body.colours, BEAD.body.alphas)}, ${stops(BEAD.body.stops)}, ${BEAD.body.stops.length}, t) * body);
  vec4 caustic = stops2(${glslRgba(BEAD.caustic.colour, BEAD.caustic.alpha)}, ${glslRgba(BEAD.caustic.colour, 0)}, length(point - ${glslVec2(BEAD.caustic.x, BEAD.caustic.y)}) / ${float(BEAD.caustic.radius)});
  colour = over(colour, caustic * body);
  colour = over(colour, paint(${glslRgb(BEAD.highlight.colour)}, ${float(BEAD.highlight.alpha)} * unitEllipse(point, ${glslVec2(BEAD.highlight.x, BEAD.highlight.y)}, ${glslVec2(BEAD.highlight.radiusX, BEAD.highlight.radiusY)}, ${float(BEAD.highlight.turn)}, unitPx)));
  return over(colour, paint(${glslRgb(BEAD.glint.colour)}, ${float(BEAD.glint.alpha)} * unitDisc(point, ${glslVec2(BEAD.glint.x, BEAD.glint.y)}, ${float(BEAD.glint.radius)}, unitPx)));
}
`;

const WATER = LENS.water;
const CAUSTIC = LENS.caustic;
const WINDOW = LENS.window;
const GLINT = LENS.glint;
const FLECK = LENS.fleck;
const WHITE = [CHANNEL_MAX, CHANNEL_MAX, CHANNEL_MAX];

/** The lights on the drop's skin seen from outside: the sky window, its glint and a fleck. */
const SKY_SOURCE = /* glsl */ `
vec4 skyLights(vec4 colour, vec2 point, float outside, float unitPx) {
  vec2 window = turn(point - ${glslVec2(WINDOW.x, WINDOW.y)}, ${float(-WINDOW.turn)}) / vec2(1.0, ${float(WINDOW.squash)});
  float windowAt = length(window) / ${float(WINDOW.radius)};
  vec4 sky = stops3(${glslRgba(WHITE, WINDOW.alphas[0])}, ${glslRgba(WHITE, WINDOW.alphas[1])}, ${glslRgba(WHITE, 0)}, ${float(WINDOW.middleStop)}, windowAt);
  colour = over(colour, sky * outside * clamp((1.0 - windowAt) * ${float(WINDOW.radius * WINDOW.squash)} * unitPx + 0.5, 0.0, 1.0));
  vec2 glintAt = point - ${glslVec2(GLINT.x, GLINT.y)};
  float inBox = step(abs(glintAt.x), ${float(GLINT.halfBox)}) * step(abs(glintAt.y), ${float(GLINT.halfBox)});
  vec4 glint = stops3(${glslRgba(WHITE, GLINT.alphas[0])}, ${glslRgba(WHITE, GLINT.alphas[1])}, ${glslRgba(WHITE, 0)}, ${float(GLINT.middleStop)}, length(glintAt) / ${float(GLINT.radius)});
  colour = over(colour, glint * outside * inBox);
  float fleck = unitEllipse(point, ${glslVec2(FLECK.x, FLECK.y)}, ${glslVec2(FLECK.radiusX, FLECK.radiusY)}, ${float(FLECK.turn)}, unitPx);
  return over(colour, paint(vec3(1.0), ${float(FLECK.alpha)} * outside * fleck));
}
`;

const LENS_SOURCE = /* glsl */ `
vec4 lens(vec2 world, vec4 shape, float inside, float magnification) {
  float strength = mix(magnification, 1.0, inside);
  float outside = 1.0 - inside;
  vec2 point = (world - shape.xy) / shape.z;
  float unitPx = shape.z * pixelsPerMetre();
  float fromShadow = length(point - ${glslVec2(LENS.shadow.x, LENS.shadow.y)});
  vec4 colour = stops2(${glslRgba(LENS.shadow.colour, LENS.shadow.alpha)}, ${glslRgba(LENS.shadow.colour, 0)}, (fromShadow - ${float(LENS.shadow.inner)}) / ${float(LENS.shadow.outer - LENS.shadow.inner)});
  colour *= clamp((${float(LENS.shadow.outer)} - fromShadow) * unitPx + 0.5, 0.0, 1.0);
  float within = unitDisc(point, vec2(0.0), 1.0, unitPx);
  if (within > 0.0) {
    vec4 inner = bladeFloor(shape.xy + (world - shape.xy) / strength);
    float t = conicT(point, vec3(${glslVec2(WATER.centreX, WATER.centreY)}, ${float(WATER.inner)}), vec3(0.0, 0.0, 1.0));
    inner = over(inner, stops5(${colours(WATER.colours, WATER.alphas)}, ${stops(WATER.stops)}, ${WATER.stops.length}, t) * outside);
    float fade = 1.0 - inside * ${float(CAUSTIC.fade)};
    vec4 gathered = stops3(${glslRgba(CAUSTIC.colour, CAUSTIC.alphas[0])}, ${glslRgba(CAUSTIC.colour, CAUSTIC.alphas[1])}, ${glslRgba(CAUSTIC.colour, 0)}, ${float(CAUSTIC.middleStop)}, length(point - ${glslVec2(CAUSTIC.x, CAUSTIC.y)}) / ${float(CAUSTIC.radius)}) * fade;
    inner = vec4(inner.rgb + gathered.rgb, min(1.0, inner.a + gathered.a));
    if (outside > 0.0) inner = skyLights(inner, point, outside, unitPx);
    colour = over(colour, inner * within);
  }
  float rimWidth = max(px(${float(LENS.rim.minPx)}), shape.z * ${float(LENS.rim.width)});
  float rim = stroke((length(point) - 1.0) * shape.z, rimWidth);
  return over(colour, paint(${glslRgb(LENS.rim.colour)}, (${float(LENS.rim.alpha)} + ${float(LENS.rim.insideAlpha)} * inside) * rim));
}
`;

export const KELP_LENS_FRAGMENT_SOURCE = /* glsl */ `${KELP_FRAGMENT_HEAD}
uniform vec4 ${UNIFORM.lens};
uniform sampler2D ${UNIFORM.bladeTile};
in vec2 vWorld;
in vec4 vLens;
${KELP_PAINT_SOURCE}${KELP_STOPS_SOURCE}${KELP_OCTAVE_SOURCE}${KELP_BLADE_FLOOR_SOURCE}${UNIT_SOURCE}${SPRITE_SOURCE}${SKY_SOURCE}${LENS_SOURCE}
void main() {
  bool isDrop = vLens.w > 0.5;
  float radiusPx = vLens.z * ${COMMON.view}.z;
  if (isDrop ? ${UNIFORM.lens}.y < 0.5 : (${UNIFORM.lens}.x < 0.5 || radiusPx < ${float(KELP_BEADS.minPx)})) discard;
  vec4 colour;
  if (isDrop) colour = lens(vWorld, vLens, ${UNIFORM.lens}.z, ${float(KELP_DROP.magnification)});
  else if (radiusPx > ${float(KELP_BEADS.lensAbovePx)}) colour = lens(vWorld, vLens, 0.0, ${float(KELP_BEADS.magnification)});
  else colour = beadSprite((vWorld - vLens.xy) / vLens.z, vLens.z * pixelsPerMetre());
  fragColour = colour * ${COMMON.frame}.y;
}
`;
