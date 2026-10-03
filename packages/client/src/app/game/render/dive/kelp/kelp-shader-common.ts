// What every kelp shader shares (docs/rendering/opening-dive.md §4, ticket #802): the world-mesh vertex shader (metres
// round the focus onto the stage), premultiplied painting in the mockup's order, antialiased coverage from a signed
// distance in metres, Canvas 2D's two-circle radial gradient, the self-similar tiles' two octaves, the coordinate hash
// bit for bit, and the signed distance bakes' lookups. GLSL ES 3.00, as template strings.

import { CHANNEL_MAX, hexToRgb } from '../../colour';
import { SHORE_HASH, SHORE_UINT32_RANGE } from '../../constants/dive-shore-noise';
import { SHORE_OCTAVE } from '../../constants/dive-shore';
import { glslFloat } from '../../cells/cell-shader-source';
import { DIVE_TEXELS_OF_SOURCE } from '../planet/dive-planet-shader';

/** The uniforms every kelp shader reads, by name. */
export const KELP_COMMON_UNIFORM = {
  /** The stage's width and height (css px), css px per metre, and device px per css px. */
  view: 'uView',
  /** The ambient clock (s), the band's alpha, a shader's own fade, and the zoom. */
  frame: 'uFrame',
} as const;

/** `vec3(r, g, b)` of 0–255 channels. */
export function glslRgb(channels: readonly number[]): string {
  return `vec3(${channels.map((channel) => glslFloat(channel / CHANNEL_MAX)).join(', ')})`;
}

/** `vec3(r, g, b)` of a hex colour. */
export function glslHex(hex: string): string {
  return `vec3(${hexToRgb(hex).map(glslFloat).join(', ')})`;
}

/** A CSS `rgba(r,g,b,a)` (0–255 channels) as `vec4(r, g, b, a)` in 0–1, unpremultiplied. */
export function glslCss(rgba: string): string {
  const numbers = (rgba.match(/[\d.]+/g) ?? []).map(Number);
  const [red = 0, green = 0, blue = 0, alpha = 1] = numbers;
  return `vec4(${[red, green, blue].map((channel) => glslFloat(channel / CHANNEL_MAX)).join(', ')}, ${glslFloat(alpha)})`;
}

/** `vec4(r, g, b, a)` of 0–255 channels and an alpha. */
export function glslRgba(channels: readonly number[], alpha: number): string {
  return `vec4(${channels.map((channel) => glslFloat(channel / CHANNEL_MAX)).join(', ')}, ${glslFloat(alpha)})`;
}

/** `vec2(x, y)`. */
export function glslVec2(x: number, y: number): string {
  return `vec2(${glslFloat(x)}, ${glslFloat(y)})`;
}

const VIEW = KELP_COMMON_UNIFORM.view;

/** The vertex shader's head: Pixi's matrices, the view, and metres to the stage's css px. */
export const KELP_VERTEX_HEAD = /* glsl */ `#version 300 es
precision highp float;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec4 ${VIEW};

/** A point in metres round the focus, as clip space. */
vec4 clipOf(vec2 world) {
  vec2 screen = world * ${VIEW}.z + 0.5 * ${VIEW}.xy;
  mat3 modelViewProjection = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  return vec4((modelViewProjection * vec3(screen, 1.0)).xy, 0.0, 1.0);
}
`;

/** A mesh in metres: each vertex where it is, its world point handed on. */
export const KELP_WORLD_VERTEX_SOURCE = /* glsl */ `${KELP_VERTEX_HEAD}
in vec2 aPosition;
out vec2 vWorld;

void main() {
  vWorld = aPosition;
  gl_Position = clipOf(aPosition);
}
`;

/** The fragment shader's head: the view and the frame. */
export const KELP_FRAGMENT_HEAD = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform vec4 ${VIEW};
uniform vec4 ${KELP_COMMON_UNIFORM.frame};
out vec4 fragColour;
`;

/** Painting, coverage, gradients and the turn, in metres and device px. */
export const KELP_PAINT_SOURCE = /* glsl */ `
/** \`src\` (premultiplied) over \`dst\`. */
vec4 over(vec4 dst, vec4 src) { return src + dst * (1.0 - src.a); }
/** A colour at an alpha, premultiplied. */
vec4 paint(vec3 rgb, float alpha) { return vec4(rgb * alpha, alpha); }
/** Device px per metre. */
float pixelsPerMetre() { return ${VIEW}.z * ${VIEW}.w; }
/** Coverage of a shape whose signed distance (+ inside) is \`metres\`: antialiased over a device px. */
float cover(float metres) { return clamp(metres * pixelsPerMetre() + 0.5, 0.0, 1.0); }
/** Coverage of a stroke \`widthM\` wide along a line \`metres\` away. */
float stroke(float metres, float widthM) { return cover(0.5 * widthM - abs(metres)); }
/** \`n\` css px in metres (the mockup's \`px\`). */
float px(float n) { return n / ${VIEW}.z; }
vec2 turn(vec2 point, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(c * point.x - s * point.y, s * point.x + c * point.y);
}
/** Coverage of an ellipse round \`centre\` with \`radii\`, turned by \`angle\`. */
float ellipse(vec2 point, vec2 centre, vec2 radii, float angle) {
  vec2 local = turn(point - centre, -angle) / radii;
  float level = length(local);
  return cover((1.0 - level) * min(radii.x, radii.y));
}
/** Distance from \`point\` to the segment \`from\` → \`to\`. */
float segmentDistance(vec2 point, vec2 from, vec2 to) {
  vec2 along = to - from;
  float t = clamp(dot(point - from, along) / max(dot(along, along), 1e-20), 0.0, 1.0);
  return length(point - from - along * t);
}
/**
 * Canvas 2D's radial gradient from the circle (c0, r0) to (c1, r1): the largest t whose circle passes through
 * \`point\` with a radius not below 0, or -1 where none does.
 */
float conicT(vec2 point, vec3 from, vec3 to) {
  vec2 centres = to.xy - from.xy;
  float radii = to.z - from.z;
  vec2 offset = point - from.xy;
  float a = dot(centres, centres) - radii * radii;
  float b = dot(offset, centres) + from.z * radii;
  float c = dot(offset, offset) - from.z * from.z;
  if (abs(a) < 1e-9) {
    float t = c / (2.0 * b);
    return from.z + t * radii >= 0.0 ? t : -1.0;
  }
  float discriminant = b * b - a * c;
  if (discriminant < 0.0) return -1.0;
  float root = sqrt(discriminant);
  float high = max((b + root) / a, (b - root) / a);
  float low = min((b + root) / a, (b - root) / a);
  if (from.z + high * radii >= 0.0) return high;
  return from.z + low * radii >= 0.0 ? low : -1.0;
}
`;

/** Gradient stops, unpremultiplied, interpolated and premultiplied as Canvas 2D paints them. */
export const KELP_STOPS_SOURCE = /* glsl */ `
vec4 premultiplied(vec4 colour) { return vec4(colour.rgb * colour.a, colour.a); }
vec4 stops2(vec4 first, vec4 last, float t) { return premultiplied(mix(first, last, clamp(t, 0.0, 1.0))); }
vec4 stops3(vec4 first, vec4 middle, vec4 last, float at, float t) {
  float clamped = clamp(t, 0.0, 1.0);
  return premultiplied(clamped < at ? mix(first, middle, clamped / at) : mix(middle, last, (clamped - at) / (1.0 - at)));
}
`;

/** The self-similar tiles at two neighbouring octaves (\`octaves\`): the coarse tile, the fine one, the fine one's weight. */
export const KELP_OCTAVE_SOURCE = /* glsl */ `
vec3 octaves(float tileM, float targetPx) {
  float level = log(${VIEW}.z * tileM / targetPx) / log(${glslFloat(SHORE_OCTAVE.ratio)});
  float whole = floor(level);
  float coarse = tileM / pow(${glslFloat(SHORE_OCTAVE.ratio)}, whole);
  return vec3(coarse, coarse / ${glslFloat(SHORE_OCTAVE.ratio)}, smoothstep(0.0, 1.0, level - whole));
}
`;

/** The coordinate hash (\`hash\`, \`coordinateHash\`), bit for bit in 32-bit unsigned arithmetic. */
export const KELP_HASH_SOURCE = /* glsl */ `
float coordinateHash(int x, int y, int salt) {
  uint mixed = (uint(x) * ${SHORE_HASH.xMultiplier}u) ^ (uint(y) * ${SHORE_HASH.yMultiplier}u) ^ (uint(salt) * ${SHORE_HASH.saltMultiplier}u);
  mixed = (mixed ^ (mixed >> ${SHORE_HASH.firstShift}u)) * ${SHORE_HASH.mixMultiplier}u;
  mixed ^= mixed >> ${SHORE_HASH.secondShift}u;
  return float(mixed) / ${glslFloat(SHORE_UINT32_RANGE)};
}
`;

/** A signed distance bake's lookup: its box (corner, size in metres) and metres a texel; + inside. */
export const KELP_DISTANCE_SOURCE = /* glsl */ `${DIVE_TEXELS_OF_SOURCE}
float bakedDistance(sampler2D bake, vec4 box, float metresPerTexel, vec2 world) {
  return texelsOf(texture(bake, (world - box.xy) / box.zw)) * metresPerTexel;
}
`;
