// The focal rock on the GPU (docs/rendering/opening-dive.md §4, ticket #802, the mockup's `boulder(…, 999, 4.2, 2)` and
// `closeBarnacles`): one quad round the stone. Its outline is the baked signed distance of the shore's `rockPath`, so
// the contact shadows, the stone, its rim light and its foam collar are each a distance and a band; the stone's
// greenstone gradient, its grain in overlay and its crystals at two octaves, the joints, the barnacle and rockweed
// cover (mean colour, far mosaic, near tile masked by it), its volume and light pool; where the sea is, the stone
// seen through it with drifting caustics and the foam; and close in, single barnacles. GLSL ES 3.00.

import { SHORE_BOULDER } from '../../constants/dive-shore-boulders';
import { SHORE_TRUE_TILE_PX } from '../../constants/dive-shore';
import { SHORE_PALETTE } from '../../constants/dive-shore-tiles';
import { KELP_CLOSE_BARNACLES } from '../../constants/dive-kelp';
import { glslFloat } from '../../cells/cell-shader-source';
import { HALF } from '../../geometry';
import { KELP_BARNACLE_SOURCE } from './kelp-shader-barnacle';
import {
  KELP_COMMON_UNIFORM as COMMON,
  KELP_DISTANCE_SOURCE,
  KELP_FRAGMENT_HEAD,
  KELP_HASH_SOURCE,
  KELP_OCTAVE_SOURCE,
  KELP_PAINT_SOURCE,
  KELP_STOPS_SOURCE,
  glslCss,
  glslHex,
} from './kelp-shader-common';
import {
  KELP_ROCK_SURFACE_SOURCE,
  KELP_ROCK_UNIFORMS_SOURCE,
  KELP_ROCK_MEAN,
  KELP_ROCK_UNIFORM as UNIFORM,
} from './kelp-shader-rock-surface';

const BOULDER = SHORE_BOULDER;
const WATERLINE = BOULDER.waterline;
const float = glslFloat;

/** The stone's outline, and the outline at `scale` of its radius moved by `offset` (`rockPath` at radius × scale). */
const OUTLINE_SOURCE = /* glsl */ `
float rockAt(vec2 world) { return bakedDistance(${UNIFORM.rockDistance}, ${UNIFORM.rockBox}, ${UNIFORM.texels}.x, world); }
float rockScaled(vec2 world, float scale, vec2 offset) {
  vec2 centre = ${UNIFORM.rock}.xy;
  return scale * rockAt(centre + (world - centre - offset) / scale);
}
float landAt(vec2 world) { return bakedDistance(${UNIFORM.seaDistance}, ${UNIFORM.seaBox}, ${UNIFORM.texels}.y, world); }
`;

/** The contact shadows to the bottom-right, the light being top-left. */
const SHADOWS_SOURCE = /* glsl */ `
vec4 contactShadows(vec2 world) {
  float radius = ${UNIFORM.rock}.z;
  vec4 colour = vec4(0.0);
${BOULDER.contactShadows
  .map(
    (shadow) =>
      `  colour = over(colour, premultiplied(${glslCss(shadow.colour)}) * cover(rockScaled(world, ${float(shadow.radius)}, radius * vec2(${float(shadow.x)}, ${float(shadow.y)}))));`,
  )
  .join('\n')}
  return colour;
}
`;

/** The rim light on the lit side: a stroke along the outline, inside it, fading toward the bottom-right. */
const RIM_SOURCE = /* glsl */ `
vec4 rimLight(vec2 world, float inside) {
  float radius = ${UNIFORM.rock}.z;
  float widthM = max(px(${float(BOULDER.rimLight.minPx)}), radius * ${float(BOULDER.rimLight.width)});
  vec2 from = ${UNIFORM.rock}.xy - radius;
  vec2 along = vec2(radius * ${float(1 + BOULDER.rimLight.to)});
  float t = dot(world - from, along) / dot(along, along);
  return stops2(${glslCss(BOULDER.rimLight.colour)}, ${glslCss(BOULDER.rimLight.clear)}, t) * cover(inside) * cover(${float(HALF)} * widthM - inside);
}
`;

/** The sun's caustics added on the stone under the water, drifting. */
const CAUSTIC = WATERLINE.caustic;

/** Under the sea: the stone seen through it, its caustics, the foam collar and the foam's lace round it. */
const WATERLINE_SOURCE = /* glsl */ `
vec4 waterline(vec4 colour, vec2 world, float stone) {
  float sea = 1.0 - cover(landAt(world));
  if (sea <= 0.0) return colour;
  float radius = ${UNIFORM.rock}.z;
  colour = over(colour, premultiplied(${glslCss(WATERLINE.underwater)}) * stone * sea);
  vec2 drift = mod(${COMMON.frame}.x * vec2(${float(CAUSTIC.driftX)}, ${float(CAUSTIC.driftY)}), ${float(CAUSTIC.tileM)});
  vec4 light = texture(${UNIFORM.causticTile}, turn(world - drift, ${float(-CAUSTIC.turn)}) / ${float(CAUSTIC.tileM)}) * ${float(CAUSTIC.alpha)} * stone * sea;
  colour = vec4(colour.rgb + light.rgb, min(1.0, colour.a + light.a));
  float collar = stroke(rockScaled(world, ${float(WATERLINE.collar.radius)}, vec2(0.0)), radius * ${float(WATERLINE.collar.width)});
  colour = over(colour, paint(${glslHex(SHORE_PALETTE.foam)}, ${float(WATERLINE.collar.alpha)} * collar * sea));
  float widthM = max(px(${float(WATERLINE.foam.minPx)}), min(radius * ${float(WATERLINE.foam.width)}, ${float(WATERLINE.foam.maxM)}));
  float lace = stroke(rockScaled(world, ${float(WATERLINE.foam.radius)}, vec2(0.0)), widthM) * sea * ${UNIFORM.texels}.z;
  float tileWeight = smoothstep(${float(SHORE_TRUE_TILE_PX.from)}, ${float(SHORE_TRUE_TILE_PX.to)}, ${float(WATERLINE.foam.tileM)} * ${COMMON.view}.z);
  colour = over(colour, premultiplied(${UNIFORM.means}[${KELP_ROCK_MEAN.foam}]) * lace * (1.0 - tileWeight));
  return over(colour, texture(${UNIFORM.foamTile}, world / ${float(WATERLINE.foam.tileM)}) * lace * tileWeight);
}
`;

/** The stone: body and surface inside its outline, rim light, waterline, and close in its barnacles. */
const MAIN_SOURCE = /* glsl */ `
void main() {
  vec2 world = vWorld;
  float radius = ${UNIFORM.rock}.z;
  vec4 colour = contactShadows(world);
  float inside = rockAt(world);
  float stone = cover(inside);
  // deep under a blade, which lets only 4 % through, the stone is drawn plain and nothing more
  float underBlade = bakedDistance(${UNIFORM.bladeCover}, ${UNIFORM.cover}[0], ${UNIFORM.cover}[1].x, world);
  bool isPlain = underBlade > ${UNIFORM.cover}[1].y;
  if (stone > 0.0) colour = over(colour, vec4(stoneColour(world, isPlain), 1.0) * stone);
  if (isPlain) {
    fragColour = colour * ${COMMON.frame}.y;
    return;
  }
  colour = over(colour, rimLight(world, inside));
  colour = waterline(colour, world, stone);
  if (${UNIFORM.texels}.w > 0.0 && stone > 0.0) {
    vec4 shells = barnacles(vec4(0.0), world, ${UNIFORM.rock}.y + radius * ${float(KELP_CLOSE_BARNACLES.belowShare)});
    colour = over(colour, shells * stone * ${UNIFORM.texels}.w);
  }
  fragColour = colour * ${COMMON.frame}.y;
}
`;

export const KELP_ROCK_FRAGMENT_SOURCE = /* glsl */ `${KELP_FRAGMENT_HEAD}${KELP_ROCK_UNIFORMS_SOURCE}
in vec2 vWorld;
${KELP_PAINT_SOURCE}${KELP_STOPS_SOURCE}${KELP_OCTAVE_SOURCE}${KELP_HASH_SOURCE}${KELP_DISTANCE_SOURCE}
${OUTLINE_SOURCE}${SHADOWS_SOURCE}${KELP_ROCK_SURFACE_SOURCE}${RIM_SOURCE}${WATERLINE_SOURCE}${KELP_BARNACLE_SOURCE}
${MAIN_SOURCE}`;
