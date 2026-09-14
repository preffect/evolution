// The arc shader (docs/rendering/own-cell-indicators.md §10): one instanced quad per arc, sized to the ring plus its stroke
// and an edge feather, and a fragment stage that measures the signed distance to the stroke — to the
// ring inside the sweep, to the nearer round cap outside it — and covers one screen px across the edge.
// So a fill is exact at any share, the stroke keeps its px width at any radius, and every arc of the
// frame is one draw call. The rows are `arc-instance.ts`'s; `arcRead` is the one table between them.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { glslFloat } from '../cells/cell-shader-source';
import { ARC_EDGE_FEATHER_PX, ARC_INSTANCE_FIELD } from '../constants';
import { RGBA_CHANNELS } from '../colour';
import { HALF } from '../geometry';

export const ARC_UNIFORM = { instances: 'uArcInstances', zoom: 'uZoom' } as const;

/** The uniform group the zoom lives in. */
export const ARC_UNIFORM_GROUP = 'arcUniforms';

const CHANNEL_SWIZZLE = ['x', 'y', 'z', 'w'] as const;

export type ArcInstanceField = keyof typeof ARC_INSTANCE_FIELD;

/** `texelFetch(uArcInstances, ivec2(texel, vInstance), 0).<channel>` for one row field. */
export function arcRead(field: ArcInstanceField): string {
  const offset = ARC_INSTANCE_FIELD[field];
  const texel = Math.floor(offset / RGBA_CHANNELS);
  const channel = CHANNEL_SWIZZLE[offset % RGBA_CHANNELS] ?? 'x';
  return `texelFetch(${ARC_UNIFORM.instances}, ivec2(${texel}, vInstance), 0).${channel}`;
}

export const ARC_VERTEX_SOURCE = /* glsl */ `#version 300 es
precision highp float;
#define HALF ${glslFloat(HALF)}
in vec2 aPosition;
in float aInstanceIndex;
uniform sampler2D ${ARC_UNIFORM.instances};
uniform float ${ARC_UNIFORM.zoom};
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
flat out int vInstance;
out vec2 vLocal;

void main() {
  vInstance = int(aInstanceIndex + HALF);
  vec2 centre = vec2(${arcRead('x')}, ${arcRead('y')});
  float extentWu = ${arcRead('radius')} + ${arcRead('halfStroke')} + ${glslFloat(ARC_EDGE_FEATHER_PX)} / ${ARC_UNIFORM.zoom};
  vLocal = aPosition * extentWu;
  mat3 modelViewProjection = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((modelViewProjection * vec3(centre + vLocal, 1.0)).xy, 0.0, 1.0);
}
`;

export const ARC_FRAGMENT_SOURCE = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
#define HALF ${glslFloat(HALF)}
#define FULL_TURN ${glslFloat(RADIANS_PER_FULL_TURN)}
uniform sampler2D ${ARC_UNIFORM.instances};
uniform float ${ARC_UNIFORM.zoom};
flat in int vInstance;
in vec2 vLocal;
out vec4 fragColour;

vec2 onRing(float radius, float angle) {
  return radius * vec2(cos(angle), sin(angle));
}

void main() {
  float radius = ${arcRead('radius')};
  float halfStroke = ${arcRead('halfStroke')};
  float start = ${arcRead('startRadians')};
  float sweep = ${arcRead('sweepRadians')};
  // Screen radians grow clockwise on the y-down screen, the same sense as the sweep.
  float along = mod(atan(vLocal.y, vLocal.x) - start, FULL_TURN);
  float distanceWu = abs(length(vLocal) - radius) - halfStroke;
  bool isPastAnEnd = sweep < FULL_TURN && along > sweep;
  bool isRoundCap = ${arcRead('isRoundCap')} > HALF;
  if (isPastAnEnd && isRoundCap) {
    float toStart = length(vLocal - onRing(radius, start));
    float toEnd = length(vLocal - onRing(radius, start + sweep));
    distanceWu = min(toStart, toEnd) - halfStroke;
  } else if (sweep < FULL_TURN && !isRoundCap) {
    // A butt end: the stroke stops on the radial line at the end angle, its edge covered over one px of arc length.
    float insideAngle = isPastAnEnd ? -min(along - sweep, FULL_TURN - along) : min(along, sweep - along);
    distanceWu = max(distanceWu, -insideAngle * length(vLocal));
  }
  float coverage = clamp(HALF - distanceWu * ${ARC_UNIFORM.zoom}, 0.0, 1.0);
  if (coverage <= 0.0) discard;
  float alpha = ${arcRead('alpha')} * coverage;
  fragColour = vec4(vec3(${arcRead('red')}, ${arcRead('green')}, ${arcRead('blue')}) * alpha, alpha);
}
`;
