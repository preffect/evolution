// The planet shader's noise (docs/rendering/opening-dive.md §4, the mockup's `20-globe.js`): hashes, value noise in two
// and three dimensions, a fractal sum over the sphere for the clouds and the biome speckle, and the adaptive sum the
// relief is drawn from, whose octaves past the pixel fade to their mean so detail grows with the zoom and never pops.
// GLSL ES 3.00, as a template string. The hashes' constants are Dave Hoskins' "hash without sine" (MIT), as the
// mockup has them; the octave rotation and offsets only decorrelate the octaves.

export const DIVE_PLANET_SHADER_NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float hash13(vec3 p3) {
  p3 = fract(p3 * .1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 x) {
  vec2 i = floor(x), f = fract(x);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1., 0.)), u.x), mix(hash12(i + vec2(0., 1.)), hash12(i + vec2(1., 1.)), u.x), u.y);
}
float valueNoise3(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  vec3 u = f * f * (3. - 2. * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), u.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), u.x), u.y),
    mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), u.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), u.x), u.y),
    u.z);
}

/** A fractal sum of 'octaves' octaves of 3-D value noise, normalised to 0..1. */
float fractal3(vec3 p, int octaves) {
  float sum = 0., amplitude = .5, weight = 0.;
  for (int i = 0; i < 7; i++) {
    if (i >= octaves) break;
    sum += amplitude * valueNoise3(p);
    weight += amplitude;
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    amplitude *= .5;
  }
  return sum / weight;
}

/**
 * The adaptive sum: 'octaves' may be fractional, and the octaves past it fade to the mean. x is the plain sum, y a
 * ridged sum (sharp crests, each octave weighted by the one before) the ranges are made of.
 */
vec2 adaptiveFractal(vec2 p, float octaves) {
  float plain = 0., ridged = 0., amplitude = .5, ridgeWeight = 1.;
  mat2 turn = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 16; i++) {
    float share = clamp(octaves - float(i), 0., 1.);
    if (share <= 0.) {
      plain += amplitude * .5;
      ridged += amplitude * .5;
    } else {
      float n = valueNoise(p);
      float ridge = 1. - abs(2. * n - 1.);
      plain += amplitude * mix(.5, n, share);
      ridged += amplitude * mix(.5, ridge * ridge * ridgeWeight, share);
      ridgeWeight = clamp(ridge * 1.4, 0., 1.);
    }
    p = turn * p + vec2(3.1, 1.7);
    amplitude *= .5;
  }
  return vec2(plain, ridged);
}
`;
