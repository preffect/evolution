// The shore shader's shared pieces (docs/rendering/opening-dive.md §4, ticket #801): the mockup's coordinate hash and
// value noise in unsigned integers, the canvas's soft-light, the level's distance grid read texel by texel, a tile laid
// at its true size in the world, and the baked level with the next one crossfading in.

import { SHORE_SEA_DATA } from '../../constants/dive-shore';
import { SHORE_HASH, SHORE_UINT32_RANGE } from '../../constants/dive-shore-noise';
import { glslFloat } from '../../cells/cell-shader-source';
import { SHORE_LIVE_FEATHER, SHORE_SHADER as UNIFORM } from './shore-shader-names';

/** The hash and value noise the mockup places the breakers' wander with (`hash`, `vnoise`). */
export const SHORE_NOISE_SOURCE = /* glsl */ `
float coordinateHash(int x, int y, int salt) {
  uint mixed = uint(x) * ${SHORE_HASH.xMultiplier}u ^ uint(y) * ${SHORE_HASH.yMultiplier}u ^ uint(salt) * ${SHORE_HASH.saltMultiplier}u;
  mixed = (mixed ^ (mixed >> ${SHORE_HASH.firstShift}u)) * ${SHORE_HASH.mixMultiplier}u;
  mixed ^= mixed >> ${SHORE_HASH.secondShift}u;
  return float(mixed) / ${glslFloat(SHORE_UINT32_RANGE)};
}

float valueNoise(vec2 point, int salt) {
  vec2 cell = floor(point);
  vec2 ease = smoothstep(0.0, 1.0, point - cell);
  int x = int(cell.x);
  int y = int(cell.y);
  float top = mix(coordinateHash(x, y, salt), coordinateHash(x + 1, y, salt), ease.x);
  float bottom = mix(coordinateHash(x, y + 1, salt), coordinateHash(x + 1, y + 1, salt), ease.x);
  return mix(top, bottom, ease.y);
}
`;

/** The canvas's soft-light (W3C compositing), per channel: what the swell and the ripples are drawn with. */
export const SHORE_SOFT_LIGHT_SOURCE = /* glsl */ `
vec3 softLight(vec3 backdrop, vec3 source) {
  vec3 darker = backdrop - (1.0 - 2.0 * source) * backdrop * (1.0 - backdrop);
  vec3 curve = mix(sqrt(backdrop), ((16.0 * backdrop - 12.0) * backdrop + 4.0) * backdrop, step(backdrop, vec3(0.25)));
  vec3 lighter = backdrop + (2.0 * source - 1.0) * (curve - backdrop);
  return mix(darker, lighter, step(0.5, source));
}
`;

/** The level's distance grid, bilinear by hand (16 bits in two bytes): the signed distance to the coast in metres. */
export const SHORE_DATA_SOURCE = /* glsl */ `
float distanceTexel(ivec2 texel) {
  ivec2 size = ivec2(${UNIFORM.data}.xy);
  vec4 raw = texelFetch(${UNIFORM.dataTexture}, clamp(texel, ivec2(0), size - 1), 0);
  float packed = floor(raw.r * 255.0 + 0.5) * 256.0 + floor(raw.g * 255.0 + 0.5);
  return (packed - ${glslFloat(SHORE_SEA_DATA.offset)}) / ${glslFloat(SHORE_SEA_DATA.cellSteps)};
}

float coastDistance(vec2 world) {
  vec2 position = world * ${UNIFORM.data}.z + ${UNIFORM.data}.xy * 0.5 - 0.5;
  vec2 cell = floor(position);
  vec2 fraction = position - cell;
  ivec2 corner = ivec2(cell);
  float top = mix(distanceTexel(corner), distanceTexel(corner + ivec2(1, 0)), fraction.x);
  float bottom = mix(distanceTexel(corner + ivec2(0, 1)), distanceTexel(corner + ivec2(1, 1)), fraction.x);
  return mix(top, bottom, fraction.y) / ${UNIFORM.data}.z;
}
`;

/** A tile laid at its true size in the world: its tile, turn and offset (metres). */
export const SHORE_SHEET_SOURCE = /* glsl */ `
vec4 sheet(sampler2D tile, vec2 world, vec4 placement) {
  float turn = placement.y;
  vec2 shifted = world - placement.zw;
  vec2 turned = vec2(cos(turn) * shifted.x + sin(turn) * shifted.y, -sin(turn) * shifted.x + cos(turn) * shifted.y);
  return texture(tile, turned / placement.x);
}
`;

/** The level (nothing outside it) and the next one crossfading in, its edge feathered so its rect never shows. */
export const SHORE_SNAPSHOT_SOURCE = /* glsl */ `
float inside(vec2 uv) {
  return step(0.0, uv.x) * step(0.0, uv.y) * step(uv.x, 1.0) * step(uv.y, 1.0);
}

vec4 snapshot(vec2 world) {
  vec2 coarseUv = world / (2.0 * ${UNIFORM.coarse}.xy) + 0.5;
  vec4 colour = texture(${UNIFORM.coarseTexture}, coarseUv) * inside(coarseUv);
  vec2 fineUv = world / (2.0 * ${UNIFORM.coarse}.zw) + 0.5;
  vec2 edges = min(fineUv, 1.0 - fineUv);
  float weight = ${UNIFORM.fineWeight} * smoothstep(0.0, ${glslFloat(SHORE_LIVE_FEATHER)}, min(edges.x, edges.y));
  if (weight > 0.0) colour = mix(colour, texture(${UNIFORM.fineTexture}, fineUv), weight);
  return colour;
}

/** How much of a stone standing in the water covers this point: the live sea keeps off it. */
float stoneCover(vec2 world) {
  if (${UNIFORM.data}.w < 0.5) return 0.0;
  return texture(${UNIFORM.stonesTexture}, world / (2.0 * ${UNIFORM.coarse}.xy) + 0.5).a;
}
`;
