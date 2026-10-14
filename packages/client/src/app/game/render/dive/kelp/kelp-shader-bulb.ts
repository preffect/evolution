// The bull kelp's bulb on the GPU (docs/rendering/opening-dive.md §4, ticket #802, the mockup's `drawBulb`): one quad
// round the gas float. The apophyses (short stalks out to the blades, lit along their middle), its shadow, the float
// on its golden gradient with the light gathering at its far edge, growth rings once it is big enough, a window-shaped
// highlight and a hard glint, and its outline. In the bulb's own unit (its radius 1). GLSL ES 3.00.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { KELP_BULB, KELP_STIPE_LOOK } from '../../constants/dive-kelp';
import { glslFloat } from '../../cells/cell-shader-source';
import { HALF } from '../../geometry';
import {
  KELP_COMMON_UNIFORM as COMMON,
  KELP_FRAGMENT_HEAD,
  KELP_PAINT_SOURCE,
  KELP_STOPS_SOURCE,
  glslHex,
  glslRgb,
} from './kelp-shader-common';

export const KELP_BULB_UNIFORM = {
  /** Each apophysis's far end, in the bulb's unit, two to a vector. */
  apophyses: 'uApophyses',
} as const;

const UNIFORM = KELP_BULB_UNIFORM;
const BULB = KELP_BULB;
const float = glslFloat;
const UNIT = 1 / BULB.radiusM;
const [glow, gold, bronze, dark] = BULB.body.colours;
export const KELP_BULB_APOPHYSIS_VECTORS = BULB.apophyses.blades.length * HALF;

/** A stroke `widthM` wide (in metres) round `gap` (in the bulb's unit). */
const STROKE_SOURCE = /* glsl */ `
float unitStroke(float gap, float widthM) { return stroke(gap * ${float(BULB.radiusM)}, widthM); }
vec2 apophysisEnd(int index) {
  vec4 pair = ${UNIFORM.apophyses}[index / 2];
  return index % 2 == 0 ? pair.xy : pair.zw;
}
`;

const APOPHYSES_SOURCE = /* glsl */ `
vec4 apophyses(vec4 colour, vec2 point) {
  for (int index = 0; index < ${BULB.apophyses.blades.length}; index++) {
    float gap = segmentDistance(point, vec2(0.0), apophysisEnd(index));
    colour = over(colour, paint(${glslHex(KELP_STIPE_LOOK.fill)}, unitStroke(gap, ${float(BULB.apophyses.widthM)})));
    colour = over(colour, paint(${glslRgb(BULB.apophysisLight.colour)}, ${float(BULB.apophysisLight.alpha)} * unitStroke(gap, ${float(BULB.apophyses.lightWidthM)})));
  }
  return colour;
}
`;

const RINGS = BULB.rings;

const BODY_SOURCE = /* glsl */ `
/** An ellipse in the bulb's unit. */
float unitEllipse(vec2 point, vec2 centre, vec2 radii, float angle) {
  return ellipse(point * ${float(BULB.radiusM)}, centre * ${float(BULB.radiusM)}, radii * ${float(BULB.radiusM)}, angle);
}
float disc(vec2 point, vec2 centre, float radius) { return cover((radius - length(point - centre)) * ${float(BULB.radiusM)}); }
vec4 rings(vec4 colour, vec2 point) {
  float angle = atan(point.y, point.x);
  float reach = length(point);
  float strongest = 0.0;
  for (int ring = 0; ring < ${RINGS.count}; ring++) {
    float start = float(ring) * ${float(RINGS.angleStep)} + ${float(RINGS.firstAngle)};
    float radius = ${float(RINGS.radius)} + ${float(RINGS.radiusStep)} * float(ring);
    float into = mod(angle - start, ${float(RADIANS_PER_FULL_TURN)});
    float gap = into <= ${float(RINGS.span)} ? abs(reach - radius) : min(length(point - radius * vec2(cos(start), sin(start))), length(point - radius * vec2(cos(start + ${float(RINGS.span)}), sin(start + ${float(RINGS.span)}))));
    strongest = max(strongest, unitStroke(gap, ${float(RINGS.width * BULB.radiusM)}));
  }
  return over(colour, paint(${glslRgb(BULB.ringColour.colour)}, ${float(BULB.ringColour.alpha)} * strongest));
}
vec4 bulb(vec4 colour, vec2 point) {
  colour = over(colour, paint(${glslRgb(BULB.shadow.colour)}, ${float(BULB.shadow.alpha)} * unitEllipse(point, vec2(${float(BULB.shadow.x)}, ${float(BULB.shadow.y)}), vec2(${float(BULB.shadow.radiusX)}, ${float(BULB.shadow.radiusY)}), 0.0)));
  float t = conicT(point, vec3(${float(BULB.body.lightX)}, ${float(BULB.body.lightY)}, ${float(BULB.body.inner)}), vec3(0.0, 0.0, 1.0));
  vec4 body = t < ${float(BULB.body.stops[0])} ? stops2(vec4(${glslHex(glow)}, 1.0), vec4(${glslHex(gold)}, 1.0), t / ${float(BULB.body.stops[0])}) : stops3(vec4(${glslHex(gold)}, 1.0), vec4(${glslHex(bronze)}, 1.0), vec4(${glslHex(dark)}, 1.0), ${float((BULB.body.stops[1] - BULB.body.stops[0]) / (1 - BULB.body.stops[0]))}, (t - ${float(BULB.body.stops[0])}) / ${float(1 - BULB.body.stops[0])});
  colour = over(colour, body * disc(point, vec2(0.0), 1.0));
  vec2 through = vec2(${float(BULB.translucency.x)}, ${float(BULB.translucency.y)});
  vec4 gathered = stops2(vec4(${glslRgb(BULB.translucency.colour)}, ${float(BULB.translucency.alpha)}), vec4(${glslRgb(BULB.translucency.colour)}, 0.0), length(point - through) / ${float(BULB.translucency.radius)});
  colour = over(colour, gathered * disc(point, vec2(0.0), ${float(BULB.translucency.clip)}));
  if (${float(BULB.radiusM)} * ${COMMON.view}.z > ${float(RINGS.fromPx)}) colour = rings(colour, point);
  float specular = unitEllipse(point, vec2(${float(BULB.specular.x)}, ${float(BULB.specular.y)}), vec2(${float(BULB.specular.radiusX)}, ${float(BULB.specular.radiusY)}), ${float(BULB.specular.turn)});
  colour = over(colour, paint(${glslRgb(BULB.specular.colour)}, ${float(BULB.specular.alpha)} * specular));
  colour = over(colour, paint(${glslRgb(BULB.glint.colour)}, ${float(BULB.glint.alpha)} * disc(point, vec2(${float(BULB.glint.x)}, ${float(BULB.glint.y)}), ${float(BULB.glint.radius)})));
  float outline = unitStroke(abs(length(point) - 1.0), max(px(${float(BULB.outline.minPx)}), ${float(BULB.outline.width * BULB.radiusM)}));
  return over(colour, paint(${glslRgb(BULB.outline.colour)}, ${float(BULB.outline.alpha)} * outline));
}
`;

export const KELP_BULB_FRAGMENT_SOURCE = /* glsl */ `${KELP_FRAGMENT_HEAD}
uniform vec4 ${UNIFORM.apophyses}[${KELP_BULB_APOPHYSIS_VECTORS}];
in vec2 vWorld;
${KELP_PAINT_SOURCE}${KELP_STOPS_SOURCE}${STROKE_SOURCE}${APOPHYSES_SOURCE}${BODY_SOURCE}
void main() {
  vec2 point = (vWorld - vec2(${float(BULB.x)}, ${float(BULB.y)})) * ${float(UNIT)};
  vec4 colour = apophyses(vec4(0.0), point);
  fragColour = bulb(colour, point) * ${COMMON.frame}.y;
}
`;
