// The kelp blade close up on the GPU (docs/rendering/opening-dive.md §4, ticket #802, the mockup's `fillBladeClose`):
// once the view is inside blade 0's margins, a quad over the stage paints its colour, its grain at two octaves along
// it and the translucent midline glow through the focus. The drop's lens magnifies the same floor
// (`kelp-shader-lens.ts`). GLSL ES 3.00.

import { KELP_BLADE_FLOOR } from '../../constants/dive-kelp-drop';
import { KELP_BLADE, KELP_BLADE_LOOK } from '../../constants/dive-kelp';
import { glslFloat } from '../../cells/cell-shader-source';
import { KELP_BLADE_ANGLE } from './kelp-ribbons';
import {
  KELP_COMMON_UNIFORM as COMMON,
  KELP_FRAGMENT_HEAD,
  KELP_OCTAVE_SOURCE,
  KELP_PAINT_SOURCE,
  glslHex,
  glslRgb,
  glslVec2,
} from './kelp-shader-common';

export const KELP_FLOOR_UNIFORM = { bladeTile: 'uBladeTile' } as const;

const FLOOR = KELP_BLADE_FLOOR;
const GLOW = FLOOR.glow;
const SURFACE = KELP_BLADE_LOOK.surface;
const float = glslFloat;

/** The blade's floor at `world`, opaque: its colour, its grain and the midline glow (screen px read off the view). */
export const KELP_BLADE_FLOOR_SOURCE = /* glsl */ `
vec4 bladeFloor(vec2 world) {
  vec4 colour = vec4(${glslHex(FLOOR.colour)}, 1.0);
  vec3 tiles = octaves(${float(SURFACE.tileM)}, ${float(SURFACE.targetPx)});
  vec2 along = turn(world, ${float(-KELP_BLADE_ANGLE)});
  colour = over(colour, texture(${KELP_FLOOR_UNIFORM.bladeTile}, along / tiles.x) * ${float(SURFACE.alpha)});
  colour = over(colour, texture(${KELP_FLOOR_UNIFORM.bladeTile}, along / tiles.y) * ${float(SURFACE.alpha)} * tiles.z);
  float glowPx = ${float(KELP_BLADE.widthM * GLOW.halfWidthShare)} * ${COMMON.view}.z;
  float acrossPx = abs(dot(world, ${glslVec2(-Math.sin(KELP_BLADE_ANGLE), Math.cos(KELP_BLADE_ANGLE))})) * ${COMMON.view}.z;
  float glow = glowPx < ${float(GLOW.flatAboveViews)} * length(${COMMON.view}.xy) ? max(0.0, 1.0 - acrossPx / glowPx) : 1.0;
  return over(colour, paint(${glslRgb(GLOW.colour)}, ${float(GLOW.alpha)} * glow));
}
`;

/** A quad over the stage: the stage's corners are ±1, its centre the focus. */
export const KELP_FLOOR_VERTEX_SOURCE = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec4 ${COMMON.view};
out vec2 vWorld;

void main() {
  vWorld = aPosition * 0.5 * ${COMMON.view}.xy / ${COMMON.view}.z;
  mat3 modelViewProjection = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((modelViewProjection * vec3((aPosition * 0.5 + 0.5) * ${COMMON.view}.xy, 1.0)).xy, 0.0, 1.0);
}
`;

export const KELP_FLOOR_FRAGMENT_SOURCE = /* glsl */ `${KELP_FRAGMENT_HEAD}
uniform sampler2D ${KELP_FLOOR_UNIFORM.bladeTile};
in vec2 vWorld;
${KELP_PAINT_SOURCE}${KELP_OCTAVE_SOURCE}${KELP_BLADE_FLOOR_SOURCE}
void main() {
  fragColour = bladeFloor(vWorld) * ${COMMON.frame}.y;
}
`;
