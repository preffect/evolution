// The kelp's ribbons on the GPU (docs/rendering/opening-dive.md §4, ticket #802, the mockup's `drawBlade` and
// `drawStipe`): a blade's fill, its grain along blade 0 at two octaves, the ruffles' folds, the translucent midline and
// its sheen, the dark margin and the lit near rim, each past the level of detail the mockup draws it at; the stipe's
// fill, midline and margin, dimmed by the sea where it runs through the water and casting its shadow only on the land
// and the rock. Shadows are the same strips, offset. GLSL ES 3.00.

import { KELP_BLADE, KELP_BLADE_LOOK, KELP_STIPE_LOOK } from '../../constants/dive-kelp';
import { glslFloat } from '../../cells/cell-shader-source';
import { HALF } from '../../geometry';
import { KELP_RIBBON_ATTRIBUTE as ATTRIBUTE, KELP_RIBBON_KIND } from './kelp-ribbon-geometry';
import { KELP_BLADE_ANGLE } from './kelp-ribbons';
import {
  KELP_COMMON_UNIFORM as COMMON,
  KELP_DISTANCE_SOURCE,
  KELP_FRAGMENT_HEAD,
  KELP_OCTAVE_SLOT,
  KELP_OCTAVE_SOURCE,
  KELP_PAINT_SOURCE,
  KELP_VERTEX_HEAD,
  glslHex,
  glslRgb,
} from './kelp-shader-common';

export const KELP_RIBBON_UNIFORM = {
  /** The strokes' reach past the strip and a shadow's (metres), blade 0's width in css px, the rock kept on land. */
  ribbon: 'uRibbon',
  /** Whether the blades and the stipe draw (1 or 0). */
  shown: 'uShown',
  rockBox: 'uRockBox',
  seaBox: 'uSeaBox',
  /** Metres a texel of the rock's and the sea's distance bakes. */
  texels: 'uTexels',
  bladeTile: 'uBladeTile',
  rockDistance: 'uRockDistance',
  seaDistance: 'uSeaDistance',
} as const;

const UNIFORM = KELP_RIBBON_UNIFORM;
const LOOK = KELP_BLADE_LOOK;
const STIPE = KELP_STIPE_LOOK;
const float = glslFloat;

export const KELP_RIBBON_VERTEX_SOURCE = /* glsl */ `${KELP_VERTEX_HEAD}
uniform vec4 ${UNIFORM.ribbon};
in vec2 ${ATTRIBUTE.position};
in vec4 ${ATTRIBUTE.frame};
in vec4 ${ATTRIBUTE.ribbon};
in vec2 ${ATTRIBUTE.style};
out vec2 vWorld;
out vec4 vRibbon;
out vec3 vStyle;

// each vertex pushed out across (and past an end) by the strokes' reach, its ribbon coordinates carried with it
void main() {
  float reach = ${ATTRIBUTE.style}.y > 0.5 ? ${UNIFORM.ribbon}.y : ${UNIFORM.ribbon}.x;
  vec2 tangent = ${ATTRIBUTE.frame}.xy;
  float side = sign(${ATTRIBUTE.frame}.z);
  vec2 world = ${ATTRIBUTE.position} + vec2(-tangent.y, tangent.x) * side * reach + tangent * ${ATTRIBUTE.frame}.w * reach;
  vWorld = world;
  vRibbon = vec4(${ATTRIBUTE.ribbon}.x + ${ATTRIBUTE.frame}.w * reach, ${ATTRIBUTE.frame}.z + side * reach, ${ATTRIBUTE.ribbon}.yz);
  vStyle = vec3(${ATTRIBUTE.style}, ${ATTRIBUTE.ribbon}.w);
  gl_Position = clipOf(world);
}
`;

const RUFFLES = LOOK.ruffles;
const HALF_PERIOD = RUFFLES.periodM * HALF;

/** The ruffles of one crest (0 lit, 1 shaded): folds from each margin in, one every half period, bowed along. */
const RUFFLE_SOURCE = /* glsl */ `
float ruffles(float u, float lateral, vec2 halves, float crest) {
  float side = lateral >= 0.0 ? halves.x : halves.y;
  float across = abs(lateral) / side;
  float widthM = ${float(RUFFLES.periodM * RUFFLES.widthShare)};
  float span = ${float(RUFFLES.outer - RUFFLES.inner)} * side;
  float bow = ${float(HALF_PERIOD * RUFFLES.bend)};
  float strongest = 0.0;
  for (int neighbour = -1; neighbour <= 1; neighbour++) {
    float fold = floor(u / ${float(HALF_PERIOD)}) + float(neighbour);
    if (mod(fold, 2.0) != crest) continue;
    float t = clamp((${float(RUFFLES.outer)} - across) / ${float(RUFFLES.outer - RUFFLES.inner)}, 0.0, 1.0);
    float centre = fold * ${float(HALF_PERIOD)} + 2.0 * t * (1.0 - t) * bow;
    float slope = 2.0 * (1.0 - 2.0 * t) * bow / span;
    float overshoot = (abs(across - clamp(across, ${float(RUFFLES.inner)}, ${float(RUFFLES.outer)}))) * side;
    float gap = length(vec2((u - centre) / sqrt(1.0 + slope * slope), overshoot));
    strongest = max(strongest, stroke(gap, widthM));
  }
  return strongest;
}
`;

/** Blade 0's grain at two octaves, laid along it. */
const GRAIN_SOURCE = /* glsl */ `
vec4 grain(vec4 colour, vec2 world, float alpha) {
  vec3 tiles = ${COMMON.octaves}[${KELP_OCTAVE_SLOT.blade}].xyz;
  vec2 along = turn(world, ${float(-KELP_BLADE_ANGLE)});
  colour = over(colour, texture(${UNIFORM.bladeTile}, along / tiles.x) * ${float(LOOK.surface.alpha)} * alpha);
  return over(colour, texture(${UNIFORM.bladeTile}, along / tiles.y) * ${float(LOOK.surface.alpha)} * tiles.z * alpha);
}
`;

const BLADE_SOURCE = /* glsl */ `
vec4 blade(vec2 world, vec4 ribbon, float inside, float isOdd) {
  float u = ribbon.x;
  float lateral = ribbon.y;
  float detailPx = ${UNIFORM.ribbon}.z;
  float body = cover(inside);
  vec4 colour = paint(isOdd > 0.5 ? ${glslHex(LOOK.fill.odd)} : ${glslHex(LOOK.fill.even)}, ${float(LOOK.fill.alpha)} * body);
  if (detailPx > ${float(LOOK.detailPx)} && body > 0.0) {
    colour = grain(colour, world, body);
    if (${float(RUFFLES.periodM)} * ${COMMON.view}.z > ${float(RUFFLES.showAbovePx)}) {
      colour = over(colour, paint(${glslRgb(RUFFLES.crest.colour)}, ${float(RUFFLES.crest.alpha)} * body * ruffles(u, lateral, ribbon.zw, 0.0)));
      colour = over(colour, paint(${glslRgb(RUFFLES.trough.colour)}, ${float(RUFFLES.trough.alpha)} * body * ruffles(u, lateral, ribbon.zw, 1.0)));
    }
    colour = over(colour, paint(${glslRgb(LOOK.midline.colour)}, ${float(LOOK.midline.alpha)} * body * stroke(lateral, ${float(KELP_BLADE.widthM * LOOK.midline.widthShare)})));
    float sheen = stroke(lateral - ${float(KELP_BLADE.widthM * LOOK.sheen.offsetShare)}, ${float(KELP_BLADE.widthM * LOOK.sheen.widthShare)});
    colour = over(colour, paint(${glslRgb(LOOK.sheen.colour)}, ${float(LOOK.sheen.alpha)} * body * sheen));
  }
  colour = over(colour, paint(${glslRgb(LOOK.margin.colour)}, ${float(LOOK.margin.alpha)} * stroke(inside, max(px(${float(LOOK.margin.minPx)}), ${float(LOOK.margin.widthM)}))));
  if (detailPx > ${float(LOOK.edgeLightPx)}) {
    float rim = stroke(ribbon.z - lateral - ${float(LOOK.edgeLight.insetM)}, max(px(${float(LOOK.edgeLight.minPx)}), ${float(LOOK.edgeLight.widthM)}));
    colour = over(colour, paint(${glslRgb(LOOK.edgeLight.colour)}, ${float(LOOK.edgeLight.alpha)} * rim * step(0.0, u) * step(u, vStyle.z)));
  }
  return colour;
}
`;

/** The stipe: its fill, its lit midline (a stroke, not clipped) and its margin. */
const STIPE_SOURCE = /* glsl */ `
vec4 stipeOnce(vec4 ribbon, float inside) {
  vec4 colour = paint(${glslHex(STIPE.fill)}, cover(inside));
  float along = step(0.0, ribbon.x) * step(ribbon.x, vStyle.z);
  colour = over(colour, paint(${glslRgb(STIPE.midline.colour)}, ${float(STIPE.midline.alpha)} * along * stroke(ribbon.y - ${float(STIPE.midline.offsetM)}, ${float(STIPE.midline.widthM)})));
  return over(colour, paint(${glslRgb(STIPE.margin.colour)}, ${float(STIPE.margin.alpha)} * stroke(inside, max(px(${float(STIPE.margin.minPx)}), ${float(STIPE.margin.widthM)}))));
}

/** Where the stipe's dry run draws: the land and the rock, by the nonzero rule the mockup clipped them with. */
float dryClip(float land, float rock) {
  return ${UNIFORM.ribbon}.w > 0.5 ? max(land, rock) : abs(land - rock);
}

/** The stipe in the water under the rock's edge, tinted by the sea, and its dry run over the rock and the land. */
vec4 stipe(vec2 world, vec4 ribbon, float inside) {
  float land = cover(bakedDistance(${UNIFORM.seaDistance}, ${UNIFORM.seaBox}, ${UNIFORM.texels}.y, world));
  float rock = cover(bakedDistance(${UNIFORM.rockDistance}, ${UNIFORM.rockBox}, ${UNIFORM.texels}.x, world));
  vec4 wet = stipeOnce(ribbon, inside);
  wet = over(wet, paint(${glslHex(STIPE.seaTint.colour)}, ${float(STIPE.seaTint.alpha)} * cover(inside) * abs(1.0 - land - rock)));
  return over(wet * (1.0 - rock), stipeOnce(ribbon, inside) * dryClip(land, rock));
}

vec4 shadowOf(vec2 world, float inside, float kind) {
  if (kind < ${float(KELP_RIBBON_KIND.stipe - HALF)}) return paint(${glslRgb(LOOK.shadow.colour)}, ${float(LOOK.shadow.alpha)} * cover(inside));
  float land = cover(bakedDistance(${UNIFORM.seaDistance}, ${UNIFORM.seaBox}, ${UNIFORM.texels}.y, world));
  float rock = cover(bakedDistance(${UNIFORM.rockDistance}, ${UNIFORM.rockBox}, ${UNIFORM.texels}.x, world));
  return paint(${glslRgb(STIPE.shadow.colour)}, ${float(STIPE.shadow.alpha)} * cover(inside) * dryClip(land, rock));
}
`;

export const KELP_RIBBON_FRAGMENT_SOURCE = /* glsl */ `${KELP_FRAGMENT_HEAD}
uniform vec4 ${UNIFORM.ribbon};
uniform vec4 ${UNIFORM.shown};
uniform vec4 ${UNIFORM.rockBox};
uniform vec4 ${UNIFORM.seaBox};
uniform vec4 ${UNIFORM.texels};
uniform sampler2D ${UNIFORM.bladeTile};
uniform sampler2D ${UNIFORM.rockDistance};
uniform sampler2D ${UNIFORM.seaDistance};
in vec2 vWorld;
in vec4 vRibbon;
in vec3 vStyle;
${KELP_PAINT_SOURCE}${KELP_OCTAVE_SOURCE}${KELP_DISTANCE_SOURCE}${RUFFLE_SOURCE}${GRAIN_SOURCE}${BLADE_SOURCE}${STIPE_SOURCE}
void main() {
  float kind = vStyle.x;
  bool isStipe = kind > ${float(KELP_RIBBON_KIND.stipe - HALF)};
  if ((isStipe ? ${UNIFORM.shown}.y : ${UNIFORM.shown}.x) < 0.5) discard;
  vec4 ribbon = vRibbon;
  float inside = min(min(ribbon.z - ribbon.y, ribbon.y + ribbon.w), min(ribbon.x, vStyle.z - ribbon.x));
  vec4 colour;
  if (vStyle.y > 0.5) colour = shadowOf(vWorld, inside, kind);
  else if (isStipe) colour = stipe(vWorld, ribbon, inside);
  else colour = blade(vWorld, ribbon, inside, kind);
  fragColour = colour * ${COMMON.frame}.y;
}
`;
