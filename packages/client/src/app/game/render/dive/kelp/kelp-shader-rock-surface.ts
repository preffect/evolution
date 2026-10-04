// The focal rock's stone inside its outline (docs/rendering/opening-dive.md §4, ticket #802, the inside of the mockup's
// `boulder` past 14 px, as `shore-boulder.ts` and `shore-boulder-surface.ts` draw it on the shore's other stones): the
// greenstone's lit gradient, its grain in overlay and its crystals at two octaves, the joints, the barnacle cover on
// its face and the rockweed skirt low down (each its mean colour far off, its patchy far tile, then its near tile
// masked by the far one), then the dark pool low-right and the soft light top-left. GLSL ES 3.00.

import { SHORE_BOULDER } from '../../constants/dive-shore-boulders';
import { SHORE_ZONE_FADE, SHORE_ZONE_TILES } from '../../constants/dive-shore';
import { KELP_ROCK_BARNACLE_COVER, KELP_ROCK_MEAN } from '../../constants/dive-kelp';
import { glslFloat } from '../../cells/cell-shader-source';
import { DIAMETER_PER_RADIUS } from '../../geometry';
import { KELP_COMMON_UNIFORM as COMMON, KELP_OCTAVE_SLOT, glslCss, glslHex } from './kelp-shader-common';

export const KELP_ROCK_UNIFORM = {
  /** The stone's centre (metres), radius and squash. */
  rock: 'uRock',
  rockBox: 'uRockBox',
  seaBox: 'uSeaBox',
  /** Metres a texel of the rock's and the sea's bakes, the foam's alpha (it flickers), the barnacles' alpha. */
  texels: 'uTexels',
  /** The joints' points, two to a vector. */
  joints: 'uJoints',
  /** The barnacles' far tile's, the rockweed's far tile's and the foam's mean colour and coverage. */
  means: 'uMeans',
  /** The blade cover bake's box, then its metres a texel and the depth past which the rock is drawn plain. */
  cover: 'uCover',
  bladeCover: 'uBladeCover',
  rockDistance: 'uRockDistance',
  seaDistance: 'uSeaDistance',
  rockTile: 'uRockTile',
  grainTile: 'uGrainTile',
  barnacleTile: 'uBarnacleTile',
  barnacleFarTile: 'uBarnacleFarTile',
  rockweedTile: 'uRockweedTile',
  rockweedFarTile: 'uRockweedFarTile',
  foamTile: 'uFoamTile',
  causticTile: 'uCausticTile',
} as const;

const UNIFORM = KELP_ROCK_UNIFORM;
const BOULDER = SHORE_BOULDER;
const float = glslFloat;

/** Points along each joint (`boulderJoint`), and the vectors that hold them, two points each. */
export const KELP_ROCK_JOINT_POINTS = Math.round(DIAMETER_PER_RADIUS / BOULDER.joints.step) + 1;
const POINTS_PER_VECTOR = 2;
export const KELP_ROCK_JOINT_VECTORS = (KELP_ROCK_JOINT_POINTS * BOULDER.joints.count) / POINTS_PER_VECTOR;
export { KELP_ROCK_MEAN };
const MEAN_COUNT = Object.keys(KELP_ROCK_MEAN).length;
/** The cover's vectors: its box, then its metres a texel and its depth. */
export const KELP_ROCK_COVER_VECTORS = 2;

const SAMPLERS = [
  UNIFORM.rockDistance,
  UNIFORM.seaDistance,
  UNIFORM.rockTile,
  UNIFORM.grainTile,
  UNIFORM.barnacleTile,
  UNIFORM.barnacleFarTile,
  UNIFORM.rockweedTile,
  UNIFORM.rockweedFarTile,
  UNIFORM.foamTile,
  UNIFORM.causticTile,
  UNIFORM.bladeCover,
];

export const KELP_ROCK_UNIFORMS_SOURCE = /* glsl */ `
uniform vec4 ${UNIFORM.rock};
uniform vec4 ${UNIFORM.rockBox};
uniform vec4 ${UNIFORM.seaBox};
uniform vec4 ${UNIFORM.texels};
uniform vec4 ${UNIFORM.joints}[${KELP_ROCK_JOINT_VECTORS}];
uniform vec4 ${UNIFORM.means}[${MEAN_COUNT}];
uniform vec4 ${UNIFORM.cover}[${KELP_ROCK_COVER_VECTORS}];
${SAMPLERS.map((name) => `uniform sampler2D ${name};`).join('\n')}
`;

const body = BOULDER.body;
const [rampLight, rampMiddle, rampDark] = BOULDER.greenRamp;

/** Canvas 2D's `overlay` of a premultiplied source at `alpha` on an opaque backdrop. */
const OVERLAY_SOURCE = /* glsl */ `
vec3 overlay(vec3 backdrop, vec4 source, float alpha) {
  vec3 colour = source.a > 0.0 ? source.rgb / source.a : vec3(0.0);
  vec3 blended = mix(2.0 * backdrop * colour, 1.0 - 2.0 * (1.0 - backdrop) * (1.0 - colour), step(0.5, backdrop));
  float share = source.a * alpha;
  return backdrop * (1.0 - share) + blended * share;
}
vec3 paintOn(vec3 backdrop, vec4 source, float alpha) { return backdrop * (1.0 - source.a * alpha) + source.rgb * alpha; }
`;

const JOINTS_SOURCE = /* glsl */ `
vec2 jointPoint(int index) {
  vec4 pair = ${UNIFORM.joints}[index / 2];
  return index % 2 == 0 ? pair.xy : pair.zw;
}
float jointGap(vec2 world) {
  float nearest = 1e9;
  for (int joint = 0; joint < ${BOULDER.joints.count}; joint++) {
    for (int point = 0; point < ${KELP_ROCK_JOINT_POINTS - 1}; point++) {
      int index = joint * ${KELP_ROCK_JOINT_POINTS} + point;
      nearest = min(nearest, segmentDistance(world, jointPoint(index), jointPoint(index + 1)));
    }
  }
  return nearest;
}
`;

const FADE = SHORE_ZONE_FADE;

/** A zone's cover inside an ellipse (`zoneFill`): mean colour, far mosaic, near tile masked by the far one. */
const ZONE_SOURCE = /* glsl */ `
vec3 zone(vec3 colour, vec2 world, vec4 shape, vec4 look, sampler2D nearTile, sampler2D farTile) {
  float within = ellipse(world, shape.xy, shape.zw, 0.0);
  if (within <= 0.0) return colour;
  float tileM = look.y;
  float farTileM = tileM * look.z;
  float alpha = look.x * within;
  float nearWeight = smoothstep(${float(FADE.nearFromPx)}, ${float(FADE.nearToPx)}, tileM * ${COMMON.view}.z);
  float farWeight = smoothstep(${float(FADE.farFromPx)}, ${float(FADE.farToPx)}, farTileM * ${COMMON.view}.z);
  vec4 mean = ${UNIFORM.means}[int(look.w)];
  colour = paintOn(colour, vec4(mean.rgb * mean.a, mean.a), alpha * (1.0 - farWeight));
  vec4 far = texture(farTile, world / farTileM);
  if (farWeight > 0.0 && nearWeight < 1.0) colour = paintOn(colour, far, alpha * farWeight * (1.0 - nearWeight));
  if (nearWeight > ${float(FADE.nearMinWeight)}) colour = paintOn(colour, texture(nearTile, world / tileM) * far.a, alpha * nearWeight);
  return colour;
}
`;

const BARNACLES = KELP_ROCK_BARNACLE_COVER;
const ROCKWEED = BOULDER.rockweed;
const VOLUME = BOULDER.volume;
const LIGHT = BOULDER.lightPool;

/** The stone's colour at `world` inside its outline, opaque; `isPlain` keeps only its lit gradient. */
const STONE_SOURCE = /* glsl */ `
vec3 stoneColour(vec2 world, bool isPlain) {
  vec2 centre = ${UNIFORM.rock}.xy;
  float radius = ${UNIFORM.rock}.z;
  float squash = ${UNIFORM.rock}.w;
  float t = conicT(world, vec3(centre + radius * vec2(${float(body.lightX)}, ${float(body.lightY)}), radius * ${float(body.core)}), vec3(centre + radius * vec2(${float(body.centreX)}, ${float(body.centreY)}), radius * ${float(body.outer)}));
  vec3 colour = stops3(vec4(${glslHex(rampLight)}, 1.0), vec4(${glslHex(rampMiddle)}, 1.0), vec4(${glslHex(rampDark)}, 1.0), ${float(body.middleStop)}, t).rgb;
  if (isPlain || radius * ${COMMON.view}.z <= ${float(BOULDER.detailFromPx)}) return colour;
  vec3 tiles = ${COMMON.octaves}[${KELP_OCTAVE_SLOT.rock}].xyz;
  colour = overlay(colour, texture(${UNIFORM.rockTile}, world / tiles.x), ${float(BOULDER.rock.greenAlpha)});
  colour = overlay(colour, texture(${UNIFORM.rockTile}, world / tiles.y), ${float(BOULDER.rock.greenAlpha)} * tiles.z);
  tiles = ${COMMON.octaves}[${KELP_OCTAVE_SLOT.grain}].xyz;
  colour = paintOn(colour, texture(${UNIFORM.grainTile}, world / tiles.x), ${float(BOULDER.grain.greenAlpha)});
  colour = paintOn(colour, texture(${UNIFORM.grainTile}, world / tiles.y), ${float(BOULDER.grain.greenAlpha)} * tiles.z);
  if (radius * ${COMMON.view}.z > ${float(BOULDER.joints.fromPx)}) {
    vec4 joint = ${glslCss(BOULDER.joints.colour)};
    float crack = stroke(jointGap(world), max(px(${float(BOULDER.joints.minPx)}), radius * ${float(BOULDER.joints.width)}));
    colour = paintOn(colour, vec4(joint.rgb * joint.a, joint.a), crack);
  }
  vec4 barnacleShape = vec4(centre + radius * vec2(${float(BARNACLES.x)}, ${float(BARNACLES.y)}), radius * vec2(${float(BARNACLES.radiusX)}, ${float(BARNACLES.radiusY)} * squash));
  colour = zone(colour, world, barnacleShape, vec4(${float(BARNACLES.alpha)}, ${float(SHORE_ZONE_TILES.barnacle.tileM)}, ${float(SHORE_ZONE_TILES.barnacle.farScale)}, 0.0), ${UNIFORM.barnacleTile}, ${UNIFORM.barnacleFarTile});
  vec4 rockweedShape = vec4(centre + radius * vec2(${float(ROCKWEED.x)}, ${float(ROCKWEED.y)}), radius * vec2(${float(ROCKWEED.radiusX)}, ${float(ROCKWEED.radiusY)} * squash));
  colour = zone(colour, world, rockweedShape, vec4(${float(ROCKWEED.alpha)}, ${float(SHORE_ZONE_TILES.rockweed.tileM)}, ${float(SHORE_ZONE_TILES.rockweed.farScale)}, 1.0), ${UNIFORM.rockweedTile}, ${UNIFORM.rockweedFarTile});
  float shadeT = conicT(world, vec3(centre + radius * vec2(${float(VOLUME.lightX)}, ${float(VOLUME.lightY)}), radius * ${float(VOLUME.inner)}), vec3(centre, radius * ${float(VOLUME.outer)}));
  vec4 shade = stops3(${glslCss(VOLUME.stops[0])}, ${glslCss(VOLUME.stops[1])}, ${glslCss(VOLUME.stops[2])}, ${float(VOLUME.middleStop)}, shadeT);
  colour = paintOn(colour, shade, 1.0);
  vec2 lightCentre = centre + radius * vec2(${float(LIGHT.x)}, ${float(LIGHT.y)});
  vec4 light = stops2(${glslCss(LIGHT.colour)}, ${glslCss(LIGHT.clear)}, length(world - lightCentre) / (radius * ${float(LIGHT.radius)}));
  return paintOn(colour, light, 1.0);
}
`;

export const KELP_ROCK_SURFACE_SOURCE = `${OVERLAY_SOURCE}${JOINTS_SOURCE}${ZONE_SOURCE}${STONE_SOURCE}`;
