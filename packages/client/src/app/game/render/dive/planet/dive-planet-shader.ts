// The planet shader (docs/rendering/opening-dive.md §4, ticket #800; the mockup's `20-globe.js`): one quad over the
// planet's render texture. Far out it ray-casts an orthographic sphere matching `d3.geoOrthographic` turned by the
// dive's rotation, with stars and the atmosphere's glow off it; close in it draws plane metres round the focus. Land
// comes from the signed distance bakes of the Natural Earth coastlines (the world's quick bake rising into its full
// one, and the Salish region's over it), relief, forest and clouds are procedural, and the light is the game's, from
// the top-left: a soft terminator, no lights on the night side. `dive-planet-frame.ts` is the TypeScript reference
// of where a pixel lands. GLSL ES 3.00, as template strings.

import {
  DIVE_SDF_LEVELS_PER_TEXEL,
  DIVE_SDF_TRUSTED_TEXELS,
  DIVE_SDF_ZERO_LEVEL,
  EARTH_RADIUS_M,
} from '../../constants';
import { HALF } from '../../geometry';
import { glslFloat } from '../../cells/cell-shader-source';
import { DIVE_PLANET_SHADER_LAND } from './dive-planet-shader-land';
import { DIVE_PLANET_SHADER_NOISE } from './dive-planet-shader-noise';

/** The uniforms and samplers, by the name the mesh sets them under; `DivePlanetFrame` names each one's meaning. */
export const DIVE_PLANET_UNIFORM = {
  resolutionPx: 'uResolutionPx',
  radiusPx: 'uRadiusPx',
  metresPerPixel: 'uMetresPerPixel',
  isPlane: 'uIsPlane',
  timeSeconds: 'uTimeSeconds',
  landEdge: 'uLandEdge',
  clouds: 'uClouds',
  regionDetail: 'uRegionDetail',
  crowns: 'uCrowns',
  reliefExaggeration: 'uReliefExaggeration',
  viewToEarth: 'uViewToEarth',
  isRegionReady: 'uIsRegionReady',
  worldFineWeight: 'uWorldFineWeight',
  focusRadians: 'uFocusRadians',
  focusEarth: 'uFocusEarth',
  sun: 'uSun',
  regionBoxRadians: 'uRegionBoxRadians',
  worldTexelMetres: 'uWorldTexelMetres',
  worldPreviewTexelMetres: 'uWorldPreviewTexelMetres',
  regionTexelMetres: 'uRegionTexelMetres',
  worldSdf: 'uWorldSdf',
  worldPreviewSdf: 'uWorldPreviewSdf',
  regionSdf: 'uRegionSdf',
} as const;
export const DIVE_PLANET_UNIFORM_GROUP = 'divePlanetUniforms';

const UNIFORM = DIVE_PLANET_UNIFORM;
const CHANNEL_MAX = 255;

export const DIVE_PLANET_VERTEX_SOURCE = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
out vec2 vUnit;

void main() {
  vUnit = aPosition;
  mat3 modelViewProjection = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((modelViewProjection * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}
`;

const UNIFORMS = /* glsl */ `
uniform vec2 ${UNIFORM.resolutionPx};
uniform float ${UNIFORM.radiusPx}, ${UNIFORM.metresPerPixel}, ${UNIFORM.isPlane}, ${UNIFORM.timeSeconds}, ${UNIFORM.landEdge}, ${UNIFORM.clouds};
uniform float ${UNIFORM.regionDetail}, ${UNIFORM.crowns}, ${UNIFORM.reliefExaggeration}, ${UNIFORM.isRegionReady}, ${UNIFORM.worldFineWeight};
uniform mat3 ${UNIFORM.viewToEarth};
uniform vec2 ${UNIFORM.focusRadians};
uniform vec3 ${UNIFORM.focusEarth}, ${UNIFORM.sun};
uniform vec4 ${UNIFORM.regionBoxRadians};
uniform float ${UNIFORM.worldTexelMetres}, ${UNIFORM.worldPreviewTexelMetres}, ${UNIFORM.regionTexelMetres};
uniform sampler2D ${UNIFORM.worldSdf}, ${UNIFORM.worldPreviewSdf}, ${UNIFORM.regionSdf};

const float PI = 3.14159265;
const float EARTH_RADIUS_M = ${glslFloat(EARTH_RADIUS_M)};
const vec3 ATMOSPHERE = vec3(0.36, 0.62, 1.0);
const vec3 SPACE = vec3(.006, .012, .024);
const vec3 STAR = vec3(.72, .8, .9);
const vec3 SEA_SHALLOW = vec3(.13, .42, .46);
const vec3 SEA_SHELF = vec3(.07, .27, .36);
const vec3 SEA_OPEN = vec3(.045, .17, .27);
const vec3 SEA_DEEP = vec3(.03, .115, .2);
const vec3 SEA_ICE = vec3(.85, .9, .94);
const vec3 SUN_GLINT = vec3(1., .96, .86);
const vec3 CLOUD = vec3(.96, .97, 1.);
const vec3 NIGHT = vec3(.004, .008, .02);
const vec3 TERMINATOR_GLOW = vec3(.3, .13, .05);
`;

/** A texel's signed distance in texels (+ on land): the finest of its three channels that has not saturated. */
export const DIVE_TEXELS_OF_SOURCE = /* glsl */ `
float texelsOf(vec4 texel) {
  float red = (texel.r * ${glslFloat(CHANNEL_MAX)} - ${glslFloat(DIVE_SDF_ZERO_LEVEL)}) / ${glslFloat(DIVE_SDF_LEVELS_PER_TEXEL.red)};
  float green = (texel.g * ${glslFloat(CHANNEL_MAX)} - ${glslFloat(DIVE_SDF_ZERO_LEVEL)}) / ${glslFloat(DIVE_SDF_LEVELS_PER_TEXEL.green)};
  float blue = (texel.b * ${glslFloat(CHANNEL_MAX)} - ${glslFloat(DIVE_SDF_ZERO_LEVEL)}) / ${glslFloat(DIVE_SDF_LEVELS_PER_TEXEL.blue)};
  return abs(red) < ${glslFloat(DIVE_SDF_TRUSTED_TEXELS.red)} ? red : abs(green) < ${glslFloat(DIVE_SDF_TRUSTED_TEXELS.green)} ? green : blue;
}
`;

const SIGNED_DISTANCE = /* glsl */ `${DIVE_TEXELS_OF_SOURCE}
/** The world's distance to the coast in metres: its quick bake rising into its full one. */
float worldMetres(vec2 uv) {
  float preview = ${UNIFORM.worldFineWeight} >= 1. ? 0. : texelsOf(texture(${UNIFORM.worldPreviewSdf}, uv)) * ${UNIFORM.worldPreviewTexelMetres};
  float fine = ${UNIFORM.worldFineWeight} <= 0. ? 0. : texelsOf(texture(${UNIFORM.worldSdf}, uv)) * ${UNIFORM.worldTexelMetres};
  return mix(preview, fine, ${UNIFORM.worldFineWeight});
}

/** The signed distance to the coast in metres (+ land), the inland distance in km, and the region's weight here. */
void coastDistance(vec2 lonLat, out float metres, out float inlandKm, out float regionWeight) {
  metres = worldMetres(vec2((lonLat.x + PI) / (2. * PI), (.5 * PI - lonLat.y) / PI));
  inlandKm = metres / 1000.;
  vec4 box = ${UNIFORM.regionBoxRadians};
  vec2 ru = vec2((lonLat.x - box.x) / (box.z - box.x), (box.w - lonLat.y) / (box.w - box.y));
  regionWeight = ${UNIFORM.isRegionReady} * smoothstep(0., .12, min(ru.x, 1. - ru.x)) * smoothstep(0., .12, min(ru.y, 1. - ru.y));
  if (regionWeight > 0.) {
    float regional = texelsOf(texture(${UNIFORM.regionSdf}, ru)) * ${UNIFORM.regionTexelMetres};
    metres = mix(metres, regional, regionWeight);
    inlandKm = mix(inlandKm, regional / 1000., regionWeight);
  }
}
`;

const SKY = /* glsl */ `
/** Off the sphere: the dark, a few twinkling stars, and the atmosphere's glow on the lit side. */
vec3 space(vec2 p, vec2 frag) {
  float r = length(p);
  vec3 c = SPACE;
  float h = hash12(floor(frag / 2.5));
  if (h > .9962) c += STAR * ((h - .9962) / .0038) * (.75 + .25 * sin(${UNIFORM.timeSeconds} * 1.7 + h * 400.));
  float lit = .3 + .7 * clamp(dot(normalize(p), normalize(${UNIFORM.sun}.xy)) * .5 + .5, 0., 1.);
  float t = (r - 1.) * ${UNIFORM.radiusPx} / max(${UNIFORM.radiusPx} * .028, 2.);
  return c + ATMOSPHERE * exp(-t * 1.3) * .75 * lit;
}

/** Cloud cover at a point on the Earth, drifting; the Olympic rain shadow keeps the focus clear. */
float clouds(vec3 e) {
  float a = ${UNIFORM.timeSeconds} * .0025;
  vec3 ce = vec3(e.x * cos(a) - e.y * sin(a), e.x * sin(a) + e.y * cos(a), e.z);
  vec3 warp = vec3(fractal3(ce * 2.3, 3), fractal3(ce * 2.3 + 5.2, 3), fractal3(ce * 2.3 + 9.7, 3));
  float n = fractal3(ce * 4.6 + warp * 2.1, 7);
  float latitude = abs(asin(e.z)) * 180. / PI;
  float band = .06 * exp(-pow((latitude - 4.) / 7., 2.)) + .07 * smoothstep(38., 56., latitude) - .07 * exp(-pow((latitude - 24.) / 7., 2.));
  float c = smoothstep(.52, .74, n + band) * .9;
  return c * smoothstep(.05, .17, acos(clamp(dot(e, ${UNIFORM.focusEarth}), -1., 1.)));
}

/** The sea: shelf and shallows from the distance to the coast, the polar ice. */
vec3 sea(float offshoreM, float latitude, float speckle) {
  vec3 c = mix(SEA_SHALLOW, SEA_SHELF, smoothstep(0., 2500., offshoreM));
  c = mix(c, SEA_OPEN, smoothstep(8000., 90000., offshoreM));
  c = mix(c, SEA_DEEP, smoothstep(150000., 600000., offshoreM));
  c *= .96 + .07 * speckle;
  if (abs(latitude) > 79.) c = mix(c, SEA_ICE, smoothstep(79., 83., abs(latitude)) * .9);
  return c;
}
`;

/** The surface's colour at a point: sea, the land over it, the Salish region's detail and forest close in. */
const SURFACE = /* glsl */ `
vec3 surface(vec2 q, vec2 lonLat, vec3 e, out float landAlpha) {
  vec2 ld = lonLat * 180. / PI;
  float metres, inlandKm, regionWeight;
  coastDistance(lonLat, metres, inlandKm, regionWeight);
  float aa = ${UNIFORM.metresPerPixel} * .9;
  landAlpha = mix(1., smoothstep(-aa, aa, metres), ${UNIFORM.landEdge});
  float speckle = fractal3(e * 9., 4);
  vec3 c = sea(-metres, ld.y, speckle);
  if (landAlpha > 0.) {
    vec3 land = biome(ld, speckle);
    if (regionWeight > 0.) {
      float meadow, shade;
      vec3 rc = region(q, ld, inlandKm, ${UNIFORM.metresPerPixel}, meadow, shade);
      if (${UNIFORM.crowns} > 0.) rc = mix(rc, canopy(q, meadow, ${UNIFORM.metresPerPixel}), ${UNIFORM.crowns});
      land = mix(land, mix(land, rc * shade, ${UNIFORM.regionDetail}), regionWeight);
    }
    c = mix(c, land, landAlpha);
  }
  return c;
}
`;

const MAIN = /* glsl */ `
in vec2 vUnit;
out vec4 fragColour;

void main() {
  vec2 frag = vec2(vUnit.x - ${glslFloat(HALF)}, ${glslFloat(HALF)} - vUnit.y) * ${UNIFORM.resolutionPx};
  vec3 normal = vec3(0., 0., 1.), e;
  vec2 q;
  float longitude, latitude, rim = 0.;
  if (${UNIFORM.isPlane} > .5) {
    q = frag * ${UNIFORM.metresPerPixel};
    latitude = ${UNIFORM.focusRadians}.y + q.y / EARTH_RADIUS_M;
    longitude = ${UNIFORM.focusRadians}.x + q.x / (EARTH_RADIUS_M * cos(${UNIFORM.focusRadians}.y));
    e = vec3(cos(latitude) * cos(longitude), cos(latitude) * sin(longitude), sin(latitude));
  } else {
    vec2 p = frag / ${UNIFORM.radiusPx};
    float r2 = dot(p, p);
    if (r2 > 1.) { fragColour = vec4(space(p, frag), 1.); return; }
    float zc = sqrt(1. - r2);
    normal = vec3(p, zc);
    rim = 1. - zc;
    e = ${UNIFORM.viewToEarth} * vec3(zc, p.x, p.y);
    latitude = asin(clamp(e.z, -1., 1.));
    longitude = atan(e.y, e.x);
    float dl = mod(longitude - ${UNIFORM.focusRadians}.x + PI, 2. * PI) - PI;
    q = vec2(dl * EARTH_RADIUS_M * cos(${UNIFORM.focusRadians}.y), (latitude - ${UNIFORM.focusRadians}.y) * EARTH_RADIUS_M);
  }
  float landAlpha;
  vec3 c = surface(q, vec2(longitude, latitude), e, landAlpha);
  float cloud = 0.;
  if (${UNIFORM.clouds} > 0.) {
    cloud = clouds(e) * ${UNIFORM.clouds};
    vec3 shadowed = normalize(e + (${UNIFORM.viewToEarth} * vec3(0., ${UNIFORM.sun}.x, ${UNIFORM.sun}.y)) * .012);
    c *= 1. - .38 * clouds(shadowed) * ${UNIFORM.clouds};
  }
  float diffuse = dot(normal, ${UNIFORM.sun});
  float day = smoothstep(-.12, .22, diffuse);
  vec3 halfway = normalize(${UNIFORM.sun} + vec3(0., 0., 1.));
  float glint = pow(max(dot(normal, halfway), 0.), 90.) * .55 * (1. - landAlpha) * (1. - cloud);
  vec3 lit = c * (.12 + .88 * max(diffuse, 0.) / ${UNIFORM.sun}.z) + SUN_GLINT * glint;
  lit = mix(lit, CLOUD * (.2 + .85 * max(diffuse, 0.) / ${UNIFORM.sun}.z), cloud * .92);
  c = mix(c * .025 + NIGHT, lit, day);
  c += TERMINATOR_GLOW * exp(-pow(diffuse / .06, 2.)) * .08 * (1. - ${UNIFORM.isPlane});
  c = mix(c, ATMOSPHERE * (.12 + .9 * max(diffuse + .15, 0.)), pow(rim, 2.4) * .75);
  c += ATMOSPHERE * .05 * day * (1. - ${UNIFORM.isPlane});
  fragColour = vec4(c, 1.);
}
`;

export const DIVE_PLANET_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
${UNIFORMS}
${DIVE_PLANET_SHADER_NOISE}
${DIVE_PLANET_SHADER_LAND}
${SIGNED_DISTANCE}
${SKY}
${SURFACE}
${MAIN}`;
