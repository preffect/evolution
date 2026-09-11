// The fragment shader's shared functions (docs/RENDERING.md §2.1): the instance reads, the
// palette read, the 16-bit strip read, the profile `r(θ)` with its derivative (the same
// expression as `radial-profile.ts`, term for term), the perpendicular membrane distance, and
// the compositing helpers every band uses. GLSL ES 3.00, as a template string.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { CHANNEL_MAX } from '../colour';
import {
  MAX_SHAPE_BUMPS,
  NOISE_STRIP_JITTER_SCALE,
  NOISE_STRIP_LOBE_SCALE,
  NOISE_STRIP_VALUE_LEVELS,
  NOISE_STRIP_WIDTH,
  PALETTE_SHADE,
  STRETCH_ACROSS_PER_ALONG,
  STRETCH_ALONG,
  STRETCH_TAPER,
} from '../constants';
import { HALF } from '../geometry';
import { BUMP_FLOATS, BUMP_TEXEL_START, CELL_INSTANCE_TEXELS, TEXEL_FLOATS } from './cell-instance';
import { glslFloat, instanceRead } from './cell-shader-source';

/** The levels of one byte channel, so a hi byte weighs `BYTE_LEVELS` lo bytes. */
const BYTE_LEVELS = CHANNEL_MAX + 1;
/** The stretch term's gains (§2.1): `S_ALONG − 1`, `1 − TAPER` and the across share. */
const STRETCH_ALONG_GAIN = STRETCH_ALONG - 1;
const STRETCH_TAPER_LOSS = 1 - STRETCH_TAPER;
const STRETCH_ACROSS = STRETCH_ACROSS_PER_ALONG;

export const CELL_SHADER_PATTERNS = /* glsl */ `
#define TAU ${glslFloat(RADIANS_PER_FULL_TURN)}
#define HALF ${glslFloat(HALF)}
#define BYTE ${glslFloat(CHANNEL_MAX)}
#define BYTE_LEVELS ${glslFloat(BYTE_LEVELS)}
#define SHADE_BASE ${PALETTE_SHADE.base}
#define SHADE_RIM ${PALETTE_SHADE.rim}
#define SHADE_EDGE ${PALETTE_SHADE.edge}
#define SHADE_CYTO_LIGHT ${PALETTE_SHADE.cytoLight}
#define SHADE_CYTO_DARK ${PALETTE_SHADE.cytoDark}

uniform sampler2D uInstances;
uniform sampler2D uStrip;
uniform sampler2D uTile;
uniform sampler2D uPalette;
uniform float uTimeSeconds;
uniform float uZoom;
uniform float uPass;
uniform vec3 uWhite;
uniform vec3 uOutline;

flat in int vInstance;
in vec2 vLocal;

struct Instance {
  vec2 centre; float r; float extent;
  float heading; float k; float palette; float lodBlend;
  float breathing; float wobbleAmplitude; float wobbleMode; float wobblePhase;
  float axialAlong; float axialAcross; float pulse; float rimBrightness;
  vec2 nucleus; float haloKind; float beadCount;
  float isOwn; float isFarDot; float isProtocell; float alpha;
  float stripRow; float stripPhase; float lobesScale; float jitterAmplitude;
};

Instance readInstance() {
  Instance inst;
  inst.centre = vec2(${instanceRead('x')}, ${instanceRead('y')});
  inst.r = ${instanceRead('radius')}; inst.extent = ${instanceRead('quadExtentRadii')};
  inst.heading = ${instanceRead('heading')}; inst.k = ${instanceRead('speedRatio')};
  inst.palette = ${instanceRead('paletteIndex')}; inst.lodBlend = ${instanceRead('lodBlend')};
  inst.breathing = ${instanceRead('breathing')}; inst.wobbleAmplitude = ${instanceRead('wobbleAmplitude')};
  inst.wobbleMode = ${instanceRead('wobbleMode')}; inst.wobblePhase = ${instanceRead('wobblePhase')};
  inst.axialAlong = ${instanceRead('axialAlong')}; inst.axialAcross = ${instanceRead('axialAcross')};
  inst.pulse = ${instanceRead('pulse')}; inst.rimBrightness = ${instanceRead('rimBrightness')};
  inst.nucleus = vec2(${instanceRead('nucleusOffsetX')}, ${instanceRead('nucleusOffsetY')});
  inst.haloKind = ${instanceRead('haloKind')}; inst.beadCount = ${instanceRead('beadCount')};
  inst.isOwn = ${instanceRead('isOwn')}; inst.isFarDot = ${instanceRead('isFarDot')};
  inst.isProtocell = ${instanceRead('isProtocell')}; inst.alpha = ${instanceRead('alpha')};
  inst.stripRow = ${instanceRead('stripRow')}; inst.stripPhase = ${instanceRead('stripPhase')};
  inst.lobesScale = ${instanceRead('lobesScale')}; inst.jitterAmplitude = ${instanceRead('jitterAmplitude')};
  return inst;
}

/** Bump 'slot' as (amplitude, centre, sigma): three floats walked across the bump texels. */
vec3 bumpAt(int slot) {
  int index = ${BUMP_TEXEL_START} * ${TEXEL_FLOATS} + slot * ${BUMP_FLOATS};
  int texel = index / ${TEXEL_FLOATS};
  vec4 first = texelFetch(uInstances, ivec2(texel, vInstance), 0);
  vec4 next = texelFetch(uInstances, ivec2(min(texel + 1, ${CELL_INSTANCE_TEXELS - 1}), vInstance), 0);
  float values[8] = float[8](first.x, first.y, first.z, first.w, next.x, next.y, next.z, next.w);
  int channel = index - texel * ${TEXEL_FLOATS};
  return vec3(values[channel], values[channel + 1], values[channel + 2]);
}

vec3 shade(Instance inst, int column) {
  return texelFetch(uPalette, ivec2(column, int(inst.palette + HALF)), 0).rgb;
}
vec3 baseColour(Instance inst) { return shade(inst, SHADE_BASE); }
vec3 rimColour(Instance inst) { return shade(inst, SHADE_RIM); }

float wrapAngle(float radians) {
  return mod(radians + TAU * HALF, TAU) - TAU * HALF;
}

/** A 16-bit (hi, lo) byte pair back to a signed value in [-scale, scale] (noise-strip.ts). */
float decodeSigned(float high, float low, float scale) {
  return (high * BYTE * BYTE_LEVELS + low * BYTE) / ${glslFloat(NOISE_STRIP_VALUE_LEVELS)} * (scale + scale) - scale;
}

/** (jitter, lobes, jitter', lobes') at 'unit' turns: two texel fetches, a lerp, the lerp's slope per radian. */
vec4 stripSample(Instance inst, float unit) {
  float width = ${glslFloat(NOISE_STRIP_WIDTH)};
  float texel = fract(unit) * width - HALF;
  float left = floor(texel);
  float fraction = texel - left;
  int row = int(inst.stripRow + HALF);
  vec4 a = texelFetch(uStrip, ivec2(int(mod(left, width)), row), 0);
  vec4 b = texelFetch(uStrip, ivec2(int(mod(left + 1.0, width)), row), 0);
  float jitterA = decodeSigned(a.x, a.y, ${glslFloat(NOISE_STRIP_JITTER_SCALE)});
  float jitterB = decodeSigned(b.x, b.y, ${glslFloat(NOISE_STRIP_JITTER_SCALE)});
  float lobesA = decodeSigned(a.z, a.w, ${glslFloat(NOISE_STRIP_LOBE_SCALE)});
  float lobesB = decodeSigned(b.z, b.w, ${glslFloat(NOISE_STRIP_LOBE_SCALE)});
  float perRadian = width / TAU;
  return vec4(mix(jitterA, jitterB, fraction), mix(lobesA, lobesB, fraction),
              (jitterB - jitterA) * perRadian, (lobesB - lobesA) * perRadian);
}

/** The speed stretch times the axial stretch at 'delta' from the heading, with d/dΔ (radial-profile.ts stretchAt). */
vec2 stretchAt(Instance inst, float delta) {
  float c = cos(delta);
  float s = sin(delta);
  float forward = max(c, 0.0);
  float rear = max(-c, 0.0);
  float alongGain = ${glslFloat(STRETCH_ALONG_GAIN)};
  float taperLoss = ${glslFloat(STRETCH_TAPER_LOSS)};
  float across = ${glslFloat(STRETCH_ACROSS)};
  float speed = 1.0 + inst.k * (alongGain * forward * forward - taperLoss * rear * rear - alongGain * across * s * s);
  float speedD = inst.k * 2.0 * (-alongGain * forward * s - taperLoss * rear * s - alongGain * across * s * c);
  float axial = 1.0 + (inst.axialAlong - 1.0) * c * c + (inst.axialAcross - 1.0) * s * s;
  float axialD = (inst.axialAcross - inst.axialAlong) * 2.0 * s * c;
  return vec2(speed * axial, speedD * axial + speed * axialD);
}

/** '1 + breathing + wobble + jitter + lobes + Σ bumps' at 'theta', with d/dθ (radial-profile.ts surfaceTerms). */
vec2 surfaceAt(Instance inst, float theta) {
  float wobbleArgument = inst.wobbleMode * theta + inst.wobblePhase;
  float surface = 1.0 + inst.breathing + inst.wobbleAmplitude * sin(wobbleArgument);
  float surfaceD = inst.wobbleAmplitude * inst.wobbleMode * cos(wobbleArgument);
  vec4 strip = stripSample(inst, theta / TAU + inst.stripPhase);
  surface += inst.jitterAmplitude * strip.x + inst.lobesScale * strip.y;
  surfaceD += inst.jitterAmplitude * strip.z + inst.lobesScale * strip.w;
  for (int slot = 0; slot < ${MAX_SHAPE_BUMPS}; slot++) {
    vec3 bump = bumpAt(slot);
    float away = wrapAngle(theta - bump.y);
    float value = bump.x * exp(-(away * away) / (2.0 * bump.z * bump.z));
    surface += value;
    surfaceD -= value * (away / (bump.z * bump.z));
  }
  return vec2(surface, surfaceD);
}

/** 'r(θ)' (x) and 'r′(θ)' (y) in world units: radial-profile.ts evaluateProfile, term for term. */
vec2 profileAt(Instance inst, float theta) {
  vec2 stretch = stretchAt(inst, wrapAngle(theta - inst.heading));
  vec2 surface = surfaceAt(inst, theta);
  float scale = inst.r * inst.pulse;
  return vec2(scale * stretch.x * surface.x, scale * (stretch.y * surface.x + stretch.x * surface.y));
}

/** The frame every band reads: the fragment in the cell frame, ρ, the undeformed ρ, d (wu and radii), one px in wu. */
struct Frame {
  vec2 p; float len; float theta;
  float rho; float rhoU; float d; float dr; float aa; float rPx;
};

Frame frameAt(Instance inst) {
  Frame frame;
  frame.p = vLocal;
  frame.len = length(vLocal);
  frame.theta = atan(vLocal.y, vLocal.x);
  vec2 profile = profileAt(inst, frame.theta);
  frame.rho = frame.len / profile.x;
  frame.rhoU = frame.len / (inst.r * inst.pulse);
  float slope = profile.y / profile.x;
  frame.d = (frame.len - profile.x) / sqrt(1.0 + slope * slope);
  frame.dr = frame.d / inst.r;
  frame.aa = 1.0 / uZoom;
  frame.rPx = inst.r * uZoom;
  return frame;
}

/** Premultiplied "over": paints 'colour' at 'alpha' onto 'under'. */
vec4 over(vec4 under, vec3 colour, float alpha) {
  float a = clamp(alpha, 0.0, 1.0);
  return vec4(colour * a, a) + under * (1.0 - a);
}

/** 1 inside a band of half-width 'halfWidth' around 'centre', feathered by 'aa', in the units of 'value'. */
float band(float value, float centre, float halfWidth, float aa) {
  return 1.0 - smoothstep(halfWidth - aa, halfWidth + aa, abs(value - centre));
}

/** A dashed ring: 1 on the dash, 0 in the gap, for an arc position in px. */
float dash(float arcPx, float dashPx, float gapPx) {
  return step(mod(arcPx, dashPx + gapPx), dashPx);
}

/** A four-stop colour ramp: 'stops' at 'positions', smoothstepped between neighbours. */
vec4 rampFour(vec4 stops[4], float positions[4], float t) {
  vec4 colour = stops[0];
  for (int stop = 1; stop < 4; stop++) colour = mix(colour, stops[stop], smoothstep(positions[stop - 1], positions[stop], t));
  return colour;
}
`;
