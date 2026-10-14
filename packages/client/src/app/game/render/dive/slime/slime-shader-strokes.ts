// The plankton's moving strokes on the GPU (docs/rendering/opening-dive.md §4, ticket #803): every straight piece of a
// limb, cilium or flagellum as a quad round it in the stage's css px, pushed out by half its width and a px of
// antialiasing; the fragment shader covers the pixels within half the width of the piece, with round or butt ends as
// the mockup's `lineCap` had them. Premultiplied colours; the slime's fade is the frame's. GLSL ES 3.00.

import { KELP_COMMON_UNIFORM, KELP_FRAGMENT_HEAD } from '../kelp/kelp-shader-common';
import { SLIME_CORNER_ATTRIBUTE, SLIME_FRAME_SOURCE } from './slime-shader-common';

export const SLIME_STROKE_ATTRIBUTE = {
  /** The piece's two ends, css px on the stage. */
  piece: 'aPiece',
  /** Half its width (css px), and 1 for round ends. */
  style: 'aStyle',
  /** Its colour, premultiplied. */
  colour: 'aColour',
} as const;

const ATTRIBUTE = SLIME_STROKE_ATTRIBUTE;
const VIEW = KELP_COMMON_UNIFORM.view;

export const SLIME_STROKE_VERTEX_SOURCE = /* glsl */ `#version 300 es
precision highp float;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec4 ${VIEW};
in vec2 ${SLIME_CORNER_ATTRIBUTE};
in vec4 ${ATTRIBUTE.piece};
in vec4 ${ATTRIBUTE.style};
in vec4 ${ATTRIBUTE.colour};
out vec2 vPoint;
flat out vec4 vPiece;
flat out vec4 vStyle;
flat out vec4 vColour;

void main() {
  vec2 from = ${ATTRIBUTE.piece}.xy;
  vec2 to = ${ATTRIBUTE.piece}.zw;
  vec2 along = to - from;
  float size = max(length(along), 1e-6);
  vec2 direction = along / size;
  vec2 normal = vec2(-direction.y, direction.x);
  float reach = ${ATTRIBUTE.style}.x + 1.0 / ${VIEW}.w;
  vec2 corner = ${SLIME_CORNER_ATTRIBUTE};
  vPoint = (corner.x < 0.0 ? from - direction * reach : to + direction * reach) + normal * corner.y * reach;
  vPiece = ${ATTRIBUTE.piece};
  vStyle = ${ATTRIBUTE.style};
  vColour = ${ATTRIBUTE.colour};
  mat3 modelViewProjection = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((modelViewProjection * vec3(vPoint, 1.0)).xy, 0.0, 1.0);
}
`;

export const SLIME_STROKE_FRAGMENT_SOURCE = /* glsl */ `${KELP_FRAGMENT_HEAD}
in vec2 vPoint;
flat in vec4 vPiece;
flat in vec4 vStyle;
flat in vec4 vColour;
${SLIME_FRAME_SOURCE}
void main() {
  vec2 from = vPiece.xy;
  vec2 along = vPiece.zw - from;
  float span = max(dot(along, along), 1e-12);
  float at = dot(vPoint - from, along) / span;
  bool isRound = vStyle.y > 0.5;
  float away = length(vPoint - from - along * clamp(at, 0.0, 1.0));
  float ends = 1.0;
  if (!isRound) {
    float beyond = max(-at, at - 1.0) * sqrt(span);
    ends = clamp(0.5 - beyond * ${VIEW}.w, 0.0, 1.0);
    away = abs(dot(vPoint - from, vec2(-along.y, along.x)) / sqrt(span));
  }
  float coverage = clamp((vStyle.x - away) * ${VIEW}.w + 0.5, 0.0, 1.0) * ends;
  fragColour = vColour * coverage * slimeAlpha();
}
`;
