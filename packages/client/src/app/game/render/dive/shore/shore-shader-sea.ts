// The shore shader's sea (docs/rendering/opening-dive.md §4, ticket #801). Under the baked level: the deep water, the
// shallows' depth ramp and the sea floor through them with the sun's caustic net, all functions of how far a point is
// from the coast (the mockup composited the same strokes into a grid a sixth of the view's resolution). Over it: the
// swell, the wind ripples, the glints, the four breakers and the swash, as the mockup drew them over its kelp beds. The
// breakers are only worked out within reach of the coast: most of the sea skips them.

import { SHORE_SURF } from '../../constants/dive-shore-live';
import { glslFloat } from '../../cells/cell-shader-source';
import { SHORE_SHADER as UNIFORM } from './shore-shader-names';

/**
 * The water under the level: the deep and the shallows' ramp, and the floor with its caustics where it shows, read off
 * the level's table by the distance to the coast (`shore-sea-ramp.ts`).
 */
export const SHORE_SEA_BASE_SOURCE = /* glsl */ `
vec4 seaRamp(float metresOut) {
  float entry = min(metresOut / ${UNIFORM.level}.z, ${UNIFORM.level}.w - 1.0);
  return texture(${UNIFORM.rampTexture}, vec2((entry + 0.5) / ${UNIFORM.level}.w, 0.5));
}

vec3 seaBase(vec2 world, float metresOut) {
  vec4 ramp = seaRamp(metresOut);
  float floorWeight = ${UNIFORM.sheetAlphas}[1].w * ramp.a;
  if (floorWeight <= 0.0) return ramp.rgb;
  vec3 floorColour = sheet(${UNIFORM.floorTexture}, world, ${UNIFORM.sheets}[7]).rgb;
  floorColour += sheet(${UNIFORM.causticTexture}, world, ${UNIFORM.sheets}[0]).rgb * ${UNIFORM.sheetAlphas}[0].x;
  floorColour += sheet(${UNIFORM.causticTexture}, world, ${UNIFORM.sheets}[1]).rgb * ${UNIFORM.sheetAlphas}[0].y;
  return mix(ramp.rgb, min(floorColour, vec3(1.0)), floorWeight);
}
`;

/** The breakers' and the swash's strokes, their dashes and their foam lace (`drawSurf`). */
export const SHORE_SURF_SOURCE = /* glsl */ `
float stroke(float offsetM, float widthM, float pixelsPerMetre) {
  return clamp((widthM * 0.5 - offsetM) * pixelsPerMetre + 0.5, 0.0, 1.0);
}

float dashes(vec2 world, vec4 breaker, float index) {
  float noise = valueNoise(vec2(world.x + breaker.w, world.y + index * ${glslFloat(SHORE_SURF.dash.perBreakerM)}) / ${glslFloat(SHORE_SURF.dash.scaleM)}, ${SHORE_SURF.wanderSalt + 1});
  float edge = fwidth(noise);
  return smoothstep(${glslFloat(SHORE_SURF.dash.threshold)} - edge, ${glslFloat(SHORE_SURF.dash.threshold)} + edge, noise);
}

/** Paints the foam lace over \`colour\` at \`alpha\`: its mean colour fading into its tile (\`strokeTrue\`). */
vec3 lace(vec3 colour, vec2 world, vec2 look, float alpha) {
  vec4 tile = texture(${UNIFORM.foamTexture}, world / look.x);
  vec4 mean = ${UNIFORM.foamMean};
  colour = mix(colour, mean.rgb, alpha * (1.0 - look.y) * mean.a);
  return colour * (1.0 - alpha * look.y * tile.a) + tile.rgb * alpha * look.y;
}

vec3 breakers(vec3 colour, vec2 world, float metresOut, float pixelsPerMetre) {
  if (metresOut > ${UNIFORM.swash}.y) return colour;
  for (int index = 0; index < ${SHORE_SURF.breakers}; index += 1) {
    vec4 breaker = ${UNIFORM.breakers}[index];
    if (breaker.y <= 0.0) continue;
    float wander = 1.0 + ${glslFloat(SHORE_SURF.wander)} * (valueNoise(world / ${glslFloat(SHORE_SURF.wanderM)} + vec2(float(index) * ${glslFloat(SHORE_SURF.wanderPerBreaker)}, 0.0), ${SHORE_SURF.wanderSalt}) - 0.5) * 2.0;
    float offsetM = abs(metresOut - breaker.x * wander);
    float dash = dashes(world, breaker, float(index));
    colour = mix(colour, ${UNIFORM.foamColour}, stroke(offsetM, breaker.z * ${glslFloat(SHORE_SURF.band.widthShare)}, pixelsPerMetre) * breaker.y * ${glslFloat(SHORE_SURF.band.alpha)});
    colour = mix(colour, ${UNIFORM.foamColour}, stroke(offsetM, breaker.z * ${glslFloat(SHORE_SURF.core.widthShare)}, pixelsPerMetre) * breaker.y * ${glslFloat(SHORE_SURF.core.alpha)} * dash);
    float laceAlpha = min(1.0, breaker.y * ${glslFloat(SHORE_SURF.lace.alphaGain)}) * stroke(offsetM, breaker.z * ${glslFloat(SHORE_SURF.lace.widthShare)}, pixelsPerMetre) * dash;
    colour = lace(colour, world, vec2(${glslFloat(SHORE_SURF.lace.tileM)}, ${UNIFORM.surf}.y), laceAlpha);
  }
  return colour;
}

vec3 swash(vec3 colour, vec2 world, float metresOut, float pixelsPerMetre) {
  float offsetM = abs(metresOut - ${UNIFORM.surf}.z);
  colour = lace(colour, world, vec2(${glslFloat(SHORE_SURF.swash.laceTileM)}, ${UNIFORM.swash}.x), ${glslFloat(SHORE_SURF.swash.laceAlpha)} * stroke(offsetM, ${UNIFORM.surf}.w, pixelsPerMetre));
  return mix(colour, ${UNIFORM.foamColour}, ${glslFloat(SHORE_SURF.swash.lineAlpha)} * stroke(offsetM, ${glslFloat(SHORE_SURF.swash.lineWidthM)}, pixelsPerMetre));
}

/** Over the level: the swell and the ripples (soft-light), the glints (added), then the surf. */
vec3 liveSea(vec3 colour, vec2 world, float metresOut, float pixelsPerMetre) {
  vec4 alphasA = ${UNIFORM.sheetAlphas}[0];
  vec4 alphasB = ${UNIFORM.sheetAlphas}[1];
  if (alphasA.z > 0.0) colour = mix(colour, softLight(colour, sheet(${UNIFORM.swellTexture}, world, ${UNIFORM.sheets}[2]).rgb), alphasA.z);
  if (alphasA.w > 0.0) colour = mix(colour, softLight(colour, sheet(${UNIFORM.rippleTexture}, world, ${UNIFORM.sheets}[3]).rgb), alphasA.w);
  if (alphasB.x > 0.0) colour = mix(colour, softLight(colour, sheet(${UNIFORM.rippleTexture}, world, ${UNIFORM.sheets}[4]).rgb), alphasB.x);
  if (alphasB.y > 0.0) colour += sheet(${UNIFORM.glintTexture}, world, ${UNIFORM.sheets}[5]).rgb * alphasB.y;
  if (alphasB.z > 0.0) colour += sheet(${UNIFORM.glintTexture}, world, ${UNIFORM.sheets}[6]).rgb * alphasB.z;
  if (${UNIFORM.surf}.x > 0.5) colour = swash(breakers(colour, world, metresOut, pixelsPerMetre), world, metresOut, pixelsPerMetre);
  return min(colour, vec3(1.0));
}
`;
