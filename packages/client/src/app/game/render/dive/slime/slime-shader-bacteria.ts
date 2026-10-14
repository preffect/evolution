// The bacteria and food specks in the slime and its pocket on the GPU (docs/rendering/opening-dive.md §4, ticket
// #803, the mockup's `drawBacteria`, `rod` and `mote`): each a quad made once (`slime-scatter.ts`) that the vertex
// shader drifts and turns on the clock exactly as the mockup did, stretched from its sprite in the bacteria's atlas
// (`slime-atlases.ts`), hidden under the mockup's least size, fading out in the dish as the game's own take over.
// GLSL ES 3.00.

import { SLIME_MOTES, SLIME_MOTE_SPRITE, SLIME_RODS, SLIME_ROD_SPRITE } from '../../constants/dive-slime-bacteria';
import { glslFloat } from '../../cells/cell-shader-source';
import { HALF } from '../../geometry';
import { KELP_FRAGMENT_HEAD, KELP_PAINT_SOURCE, KELP_TURN_SOURCE, KELP_VERTEX_HEAD } from '../kelp/kelp-shader-common';
import { bacteriaAtlasLayout } from './slime-atlases';
import type { AtlasRect } from './slime-sprite-ladder';
import {
  SLIME_COMMON_UNIFORM,
  SLIME_CORNER_ATTRIBUTE,
  SLIME_DROP_SOURCE,
  SLIME_FRAME_SOURCE,
  SLIME_OFF_STAGE,
} from './slime-shader-common';

export const SLIME_BACTERIA_ATTRIBUTE = {
  /** A rod's place (metres), length and width (metres); or a speck's place, radius and 1 for a lipid. */
  body: 'aBody',
  /** A rod's heading, drift phase, kind and 1 in the dish; or a speck's column, row and 1 in the dish. */
  motion: 'aMotion',
} as const;

export const SLIME_BACTERIA_UNIFORM = { atlas: 'uBacteriaAtlas' } as const;

const float = glslFloat;
const ATTRIBUTE = SLIME_BACTERIA_ATTRIBUTE;
const FRAME = SLIME_COMMON_UNIFORM.frame;
const VIEW = SLIME_COMMON_UNIFORM.view;
const LAYOUT = bacteriaAtlasLayout();

function rects(list: readonly AtlasRect[]): string {
  const vectors = list.map((rect) => `vec4(${[rect.x, rect.y, rect.width, rect.height].map(float).join(', ')})`);
  return `vec4[${list.length}](${vectors.join(', ')})`;
}

const VARYINGS = /* glsl */ `
flat out vec4 vRect;
flat out float vAlpha;
out vec2 vAt;
out vec2 vWorld;
`;

const ROD = SLIME_RODS;
const ROD_SPRITE = SLIME_ROD_SPRITE;

export const SLIME_ROD_VERTEX_SOURCE = /* glsl */ `${KELP_VERTEX_HEAD}
uniform vec4 ${FRAME};
in vec2 ${SLIME_CORNER_ATTRIBUTE};
in vec4 ${ATTRIBUTE.body};
in vec4 ${ATTRIBUTE.motion};
${VARYINGS}${KELP_TURN_SOURCE}
const vec4 RECTS[${LAYOUT.rods.length}] = ${rects(LAYOUT.rods)};

void main() {
  float time = ${FRAME}.x;
  float phase = ${ATTRIBUTE.motion}.y;
  vec2 drift = vec2(sin(time * ${float(ROD.rates.x)} + phase), cos(time * ${float(ROD.rates.y)} + phase * ${float(ROD.phase.yScale)}));
  float angle = ${ATTRIBUTE.motion}.x + sin(time * ${float(ROD.rates.turn)} + phase) * ${float(ROD.turn)};
  vec2 reach = ${ATTRIBUTE.body}.zw * vec2(${float((ROD_SPRITE.canvas.width * HALF) / ROD_SPRITE.length)}, ${float((ROD_SPRITE.canvas.height * HALF) / ROD_SPRITE.width)});
  vWorld = ${ATTRIBUTE.body}.xy + drift * ${float(ROD.driftM)} + turn(${SLIME_CORNER_ATTRIBUTE} * reach, angle);
  vAt = ${SLIME_CORNER_ATTRIBUTE} * 0.5 + 0.5;
  vRect = RECTS[int(${ATTRIBUTE.motion}.z + 0.5)];
  float dark = ${FRAME}.z;
  float alpha = ${ATTRIBUTE.motion}.w > 0.5 ? 1.0 - dark : ${float(ROD.alpha.slime)} + ${float(ROD.alpha.slimeDarkField)} * dark;
  vAlpha = alpha * ${FRAME}.y;
  bool isShown = ${ATTRIBUTE.body}.z * ${VIEW}.z >= ${float(ROD.minPx)};
  gl_Position = isShown ? clipOf(vWorld) : ${SLIME_OFF_STAGE};
}
`;

const MOTE = SLIME_MOTES;
const MOTE_SPRITE = SLIME_MOTE_SPRITE;

export const SLIME_MOTE_VERTEX_SOURCE = /* glsl */ `${KELP_VERTEX_HEAD}
uniform vec4 ${FRAME};
in vec2 ${SLIME_CORNER_ATTRIBUTE};
in vec4 ${ATTRIBUTE.body};
in vec4 ${ATTRIBUTE.motion};
${VARYINGS}
const vec4 RECTS[${LAYOUT.motes.length}] = ${rects(LAYOUT.motes)};

void main() {
  float time = ${FRAME}.x;
  vec2 drift = vec2(sin(time * ${float(MOTE.rates.x)} + ${ATTRIBUTE.motion}.x), cos(time * ${float(MOTE.rates.y)} + ${ATTRIBUTE.motion}.y));
  float reach = ${ATTRIBUTE.body}.z * ${float(HALF / MOTE_SPRITE.bodyShare)};
  vWorld = ${ATTRIBUTE.body}.xy + drift * ${float(MOTE.driftM)} + ${SLIME_CORNER_ATTRIBUTE} * reach;
  vAt = ${SLIME_CORNER_ATTRIBUTE} * 0.5 + 0.5;
  vRect = RECTS[int(${ATTRIBUTE.body}.w + 0.5)];
  vAlpha = (${ATTRIBUTE.motion}.z > 0.5 ? 1.0 - ${FRAME}.z : 1.0) * ${FRAME}.y;
  bool isShown = ${ATTRIBUTE.body}.z * ${VIEW}.z >= ${float(MOTE.minPx)};
  gl_Position = isShown ? clipOf(vWorld) : ${SLIME_OFF_STAGE};
}
`;

/** Both draw their sprite from the atlas, at their alpha, clipped to the drop. */
export const SLIME_BACTERIA_FRAGMENT_SOURCE = /* glsl */ `${KELP_FRAGMENT_HEAD}
uniform sampler2D ${SLIME_BACTERIA_UNIFORM.atlas};
flat in vec4 vRect;
flat in float vAlpha;
in vec2 vAt;
in vec2 vWorld;
${KELP_PAINT_SOURCE}${SLIME_FRAME_SOURCE}${SLIME_DROP_SOURCE}
void main() {
  vec2 uv = (vRect.xy + vAt * vRect.zw) / vec2(textureSize(${SLIME_BACTERIA_UNIFORM.atlas}, 0));
  fragColour = texture(${SLIME_BACTERIA_UNIFORM.atlas}, uv) * vAlpha * insideDrop(vWorld);
}
`;
