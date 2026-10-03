// The shore's shader (docs/rendering/opening-dive.md §4, ticket #801): one quad over the stage. Under the baked level
// of detail it lays the water (`shore-shader-sea.ts`) and, while the planet's forest is not drawn, the flat forest
// under the land; over it, the live sea where no stone stands in the water. The numbers are `shore-live.ts`'s each
// frame and the level's each time it changes.

import { SHORE_SURF } from '../../constants/dive-shore-live';
import {
  SHORE_DATA_SOURCE,
  SHORE_NOISE_SOURCE,
  SHORE_SHEET_SOURCE,
  SHORE_SNAPSHOT_SOURCE,
  SHORE_SOFT_LIGHT_SOURCE,
} from './shore-shader-common';
import { SHORE_SHADER as UNIFORM, SHORE_SHEET_ALPHA_VECTORS, SHORE_SHEET_COUNT } from './shore-shader-names';
import { SHORE_SEA_BASE_SOURCE, SHORE_SURF_SOURCE } from './shore-shader-sea';

export const SHORE_VERTEX_SOURCE = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec4 ${UNIFORM.view};
out vec2 vScreen;

// the quad's corners are at ±1: the stage's centre is 0, its corners half the stage out
void main() {
  vScreen = aPosition * 0.5 * ${UNIFORM.view}.xy;
  mat3 modelViewProjection = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((modelViewProjection * vec3((aPosition * 0.5 + 0.5) * ${UNIFORM.view}.xy, 1.0)).xy, 0.0, 1.0);
}
`;

const SAMPLERS = [
  UNIFORM.coarseTexture,
  UNIFORM.fineTexture,
  UNIFORM.dataTexture,
  UNIFORM.stonesTexture,
  UNIFORM.causticTexture,
  UNIFORM.swellTexture,
  UNIFORM.rippleTexture,
  UNIFORM.glintTexture,
  UNIFORM.foamTexture,
  UNIFORM.floorTexture,
  UNIFORM.rampTexture,
];

const UNIFORMS = /* glsl */ `
uniform vec4 ${UNIFORM.view};
uniform vec4 ${UNIFORM.coarse};
uniform float ${UNIFORM.fineWeight};
uniform float ${UNIFORM.bandAlpha};
uniform vec4 ${UNIFORM.data};
uniform vec4 ${UNIFORM.level};
uniform vec4 ${UNIFORM.sheets}[${SHORE_SHEET_COUNT}];
uniform vec4 ${UNIFORM.sheetAlphas}[${SHORE_SHEET_ALPHA_VECTORS}];
uniform vec4 ${UNIFORM.breakers}[${SHORE_SURF.breakers}];
uniform vec4 ${UNIFORM.surf};
uniform vec4 ${UNIFORM.swash};
uniform vec4 ${UNIFORM.foamMean};
uniform vec3 ${UNIFORM.foamColour};
uniform vec3 ${UNIFORM.landColour};
uniform vec3 ${UNIFORM.seaColour};
${SAMPLERS.map((name) => `uniform sampler2D ${name};`).join('\n')}
`;

export const SHORE_FRAGMENT_SOURCE = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
${UNIFORMS}
in vec2 vScreen;
out vec4 fragColour;
${SHORE_NOISE_SOURCE}${SHORE_SOFT_LIGHT_SOURCE}${SHORE_DATA_SOURCE}${SHORE_SHEET_SOURCE}${SHORE_SNAPSHOT_SOURCE}
${SHORE_SEA_BASE_SOURCE}${SHORE_SURF_SOURCE}
void main() {
  float pixelsPerMetre = ${UNIFORM.view}.z;
  vec2 world = vScreen / pixelsPerMetre;
  float signedM = coastDistance(world);
  float land = clamp(signedM * pixelsPerMetre + 0.5, 0.0, 1.0);
  float metresOut = max(-signedM, 0.0);
  vec4 under = vec4(seaBase(world, metresOut), 1.0) * (1.0 - land) + vec4(${UNIFORM.landColour}, 1.0) * land * ${UNIFORM.view}.w;
  vec4 level = snapshot(world);
  vec4 colour = level + (1.0 - level.a) * under;
  float sea = (1.0 - land) * (1.0 - stoneCover(world));
  if (sea > 0.0 && colour.a > 0.0) {
    vec3 lit = liveSea(colour.rgb / colour.a, world, metresOut, pixelsPerMetre);
    colour.rgb = mix(colour.rgb, lit * colour.a, sea);
  }
  fragColour = colour * ${UNIFORM.bandAlpha};
}
`;
