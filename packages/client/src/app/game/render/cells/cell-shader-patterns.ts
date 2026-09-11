// The fragment shader's shared functions (docs/RENDERING.md §2.1): the instance reads, the
// perpendicular membrane distance, the profile `r(θ)` with its derivative (the same expression as
// `radial-profile.ts`, term for term), the 16-bit strip read, the palette read and the hashes the
// speckle and the noise bands use. GLSL ES 3.00, as a template string.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
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
import { BUMP_TEXEL_START_GLSL, glslFloat, instanceRead } from './cell-shader-source';

const TAU = glslFloat(RADIANS_PER_FULL_TURN);

export const CELL_SHADER_PATTERNS = /* glsl */ `
#define TAU ${TAU}
#define BYTE 255.0

uniform sampler2D uInstances;
uniform sampler2D uStrip;
uniform sampler2D uTile;
uniform sampler2D uPalette;
uniform float uTimeSeconds;
uniform float uZoom;
uniform float uPass;

flat in int vInstance;
in vec2 vLocal;

struct Instance {
  vec2 centre; float r; float extent;
  float heading; float k; float palette; float lodBlend;
  float ciliaCount; float wallScale; float speckleDensity; float filamentCount;
  float breathing; float wobbleAmplitude; float wobbleMode; float wobblePhase;
  float axialAlong; float axialAcross; float pulse; float tintMix;
  vec2 nucleus; float haloKind; float beadCount;
  float isOwn; float warningRingPx; float selfRingFill; float alpha;
  float stripRow; float stripPhase; float rimBrightness; float passBAlpha;
  float isFarDot; float isProtocell; float ciliaBeatHz; float haloRadiiScale;
  float lobesScale; float jitterAmplitude; float rimDash;
};

Instance readInstance() {
  Instance inst;
  inst.centre = vec2(${instanceRead('x')}, ${instanceRead('y')});
  inst.r = ${instanceRead('radius')}; inst.extent = ${instanceRead('quadExtentRadii')};
  inst.heading = ${instanceRead('heading')}; inst.k = ${instanceRead('speedRatio')};
  inst.palette = ${instanceRead('paletteIndex')}; inst.lodBlend = ${instanceRead('lodBlend')};
  inst.ciliaCount = ${instanceRead('ciliaCount')}; inst.wallScale = ${instanceRead('wallScale')};
  inst.speckleDensity = ${instanceRead('speckleDensity')}; inst.filamentCount = ${instanceRead('filamentCount')};
  inst.breathing = ${instanceRead('breathing')}; inst.wobbleAmplitude = ${instanceRead('wobbleAmplitude')};
  inst.wobbleMode = ${instanceRead('wobbleMode')}; inst.wobblePhase = ${instanceRead('wobblePhase')};
  inst.axialAlong = ${instanceRead('axialAlong')}; inst.axialAcross = ${instanceRead('axialAcross')};
  inst.pulse = ${instanceRead('pulse')}; inst.tintMix = ${instanceRead('tintMix')};
  inst.nucleus = vec2(${instanceRead('nucleusOffsetX')}, ${instanceRead('nucleusOffsetY')});
  inst.haloKind = ${instanceRead('haloKind')}; inst.beadCount = ${instanceRead('beadCount')};
  inst.isOwn = ${instanceRead('isOwn')}; inst.warningRingPx = ${instanceRead('warningRingPx')};
  inst.selfRingFill = ${instanceRead('selfRingFill')}; inst.alpha = ${instanceRead('alpha')};
  inst.stripRow = ${instanceRead('stripRow')}; inst.stripPhase = ${instanceRead('stripPhase')};
  inst.rimBrightness = ${instanceRead('rimBrightness')}; inst.passBAlpha = ${instanceRead('passBAlpha')};
  inst.isFarDot = ${instanceRead('isFarDot')}; inst.isProtocell = ${instanceRead('isProtocell')};
  inst.ciliaBeatHz = ${instanceRead('ciliaBeatHz')}; inst.haloRadiiScale = ${instanceRead('haloRadiiScale')};
  inst.lobesScale = ${instanceRead('lobesScale')}; inst.jitterAmplitude = ${instanceRead('jitterAmplitude')};
  inst.rimDash = ${instanceRead('rimDash')};
  return inst;
}

vec3 bumpAt(int slot) {
  int index = ${BUMP_TEXEL_START_GLSL} * 4 + slot * 3;
  vec4 texel = texelFetch(uInstances, ivec2(index / 4, vInstance), 0);
  vec4 next = texelFetch(uInstances, ivec2(index / 4 + 1, vInstance), 0);
  float values[8] = float[8](texel.x, texel.y, texel.z, texel.w, next.x, next.y, next.z, next.w);
  int channel = index - (index / 4) * 4;
  return vec3(values[channel], values[channel + 1], values[channel + 2]);
}

vec3 shade(Instance inst, int column) {
  return texelFetch(uPalette, ivec2(column, int(inst.palette + 0.5)), 0).rgb;
}
#define SHADE_BASE ${PALETTE_SHADE.base}
#define SHADE_RIM ${PALETTE_SHADE.rim}
#define SHADE_NUCLEUS ${PALETTE_SHADE.nucleus}
#define SHADE_EDGE ${PALETTE_SHADE.edge}
#define SHADE_CYTO_LIGHT ${PALETTE_SHADE.cytoLight}
#define SHADE_CYTO_DARK ${PALETTE_SHADE.cytoDark}
#define SHADE_CHLORO_BASE ${PALETTE_SHADE.chloroBase}

/** The membrane's base and rim, tinted toward the chloroplast base with the trait (VISUAL-STYLE §3). */
vec3 baseColour(Instance inst) { return mix(shade(inst, SHADE_BASE), shade(inst, SHADE_CHLORO_BASE), inst.tintMix); }
vec3 rimColour(Instance inst) { return mix(shade(inst, SHADE_RIM), shade(inst, SHADE_CHLORO_BASE), inst.tintMix * 0.5); }

float wrapAngle(float radians) {
  float wrapped = mod(radians + TAU * 0.5, TAU) - TAU * 0.5;
  return wrapped;
}

float decodeSigned(float high, float low, float scale) {
  return (high * BYTE * 256.0 + low * BYTE) / ${glslFloat(NOISE_STRIP_VALUE_LEVELS)} * 2.0 * scale - scale;
}

/** (jitter, lobes, jitter', lobes') at 'unit' turns: two texel fetches, a lerp, the lerp's slope per radian. */
vec4 stripSample(Instance inst, float unit) {
  float width = ${glslFloat(NOISE_STRIP_WIDTH)};
  float texel = fract(unit) * width - 0.5;
  float left = floor(texel);
  float fraction = texel - left;
  int row = int(inst.stripRow + 0.5);
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

/** 'r(θ)' (x) and 'r′(θ)' (y) in world units: radial-profile.ts, term for term. */
vec2 profileAt(Instance inst, float theta) {
  float delta = wrapAngle(theta - inst.heading);
  float c = cos(delta);
  float s = sin(delta);
  float forward = max(c, 0.0);
  float rear = max(-c, 0.0);
  float alongGain = ${glslFloat(STRETCH_ALONG)} - 1.0;
  float taperLoss = 1.0 - ${glslFloat(STRETCH_TAPER)};
  float across = ${glslFloat(STRETCH_ACROSS_PER_ALONG)};
  float speed = 1.0 + inst.k * (alongGain * forward * forward - taperLoss * rear * rear - alongGain * across * s * s);
  float speedD = inst.k * 2.0 * (-alongGain * forward * s - taperLoss * rear * s - alongGain * across * s * c);
  float axial = 1.0 + (inst.axialAlong - 1.0) * c * c + (inst.axialAcross - 1.0) * s * s;
  float axialD = (inst.axialAcross - inst.axialAlong) * 2.0 * s * c;
  float stretch = speed * axial;
  float stretchD = speedD * axial + speed * axialD;
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
    surfaceD += -value * (away / (bump.z * bump.z));
  }
  float scale = inst.r * inst.pulse;
  return vec2(scale * stretch * surface, scale * (stretchD * surface + stretch * surfaceD));
}

/** The frame every band reads: the membrane distance in wu and in radii, the radial coordinates. */
struct Frame {
  vec2 p; float len; float theta;
  float r; float rho; float rhoU; float d; float dr; float aa; float rPx;
};

Frame frameAt(Instance inst) {
  Frame frame;
  frame.p = vLocal;
  frame.len = length(vLocal);
  frame.theta = atan(vLocal.y, vLocal.x);
  vec2 profile = profileAt(inst, frame.theta);
  frame.r = inst.r;
  frame.rho = frame.len / profile.x;
  frame.rhoU = frame.len / (inst.r * inst.pulse);
  float slope = profile.y / profile.x;
  frame.d = (frame.len - profile.x) / sqrt(1.0 + slope * slope);
  frame.dr = frame.d / inst.r;
  frame.aa = 1.0 / uZoom;
  frame.rPx = inst.r * uZoom;
  return frame;
}

float hash21(vec2 point) {
  vec3 mixed = fract(vec3(point.xyx) * 0.1031);
  mixed += dot(mixed, mixed.yzx + 33.33);
  return fract((mixed.x + mixed.y) * mixed.z);
}

/** Premultiplied "over": paints 'source' (straight colour, alpha) onto 'under'. */
vec4 over(vec4 under, vec3 colour, float alpha) {
  float a = clamp(alpha, 0.0, 1.0);
  return vec4(colour * a, a) + under * (1.0 - a);
}

/** A soft band of half-width 'half' around 'centre' with 'aa' feathering, in the units of 'value'. */
float band(float value, float centre, float half, float aa) {
  return 1.0 - smoothstep(half - aa, half + aa, abs(value - centre));
}

/** A dashed ring: 1 on the dash, 0 in the gap, for an arc length 's' in px and dash / gap in px. */
float dash(float arcPx, float dashPx, float gapPx) {
  return step(mod(arcPx, dashPx + gapPx), dashPx);
}
`;
