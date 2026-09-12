// The cell shader (docs/RENDERING.md §2): one instanced quad, the instance rows in a float
// texture, the two passes selected by `uPass`. The vertex stage sizes the quad from the
// instance's `r × quadExtentRadii`; the fragment stage evaluates the profile and paints the bands
// of pass A (bodies, under the organelle sprites) or pass B (membranes, over them).

import { CELL_SHADER_BANDS } from './cell-shader-bands';
import { CELL_SHADER_MEMBRANE } from './cell-shader-membrane';
import { CELL_SHADER_PATTERNS } from './cell-shader-patterns';
import { CELL_SHADER_TELLS } from './cell-shader-tells';
import { HALF } from '../geometry';
import { CELL_PASS, glslFloat, instanceRead } from './cell-shader-source';

/** `uPass` is a float; the pass boundary sits between the two ids. */
const PASS_BOUNDARY = (CELL_PASS.body + CELL_PASS.membrane) * HALF;

export const CELL_VERTEX_SOURCE = /* glsl */ `#version 300 es
precision highp float;
#define HALF ${glslFloat(HALF)}
in vec2 aPosition;
in float aInstanceIndex;
uniform sampler2D uInstances;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
flat out int vInstance;
out vec2 vLocal;

void main() {
  vInstance = int(aInstanceIndex + HALF);
  vec2 centre = vec2(${instanceRead('x')}, ${instanceRead('y')});
  float extentWu = ${instanceRead('radius')} * ${instanceRead('quadExtentRadii')};
  vLocal = aPosition * extentWu;
  vec2 world = centre + vLocal;
  mat3 modelViewProjection = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((modelViewProjection * vec3(world, 1.0)).xy, 0.0, 1.0);
}
`;

export const CELL_FRAGMENT_SOURCE = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
${CELL_SHADER_PATTERNS}
${CELL_SHADER_BANDS}
${CELL_SHADER_TELLS}
${CELL_SHADER_MEMBRANE}
out vec4 fragColour;

void main() {
  Instance inst = readInstance();
  Frame frame = frameAt(inst);
  vec4 acc = uPass < ${glslFloat(PASS_BOUNDARY)} ? bodyPass(inst, frame) : membranePass(inst, frame);
  fragColour = acc * inst.alpha;
}
`;
