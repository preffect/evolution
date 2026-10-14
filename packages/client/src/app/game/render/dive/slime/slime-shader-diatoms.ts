// The floor's diatoms on the GPU (docs/rendering/opening-dive.md §4, ticket #803, the mockup's `drawFloorDiatoms`):
// each a quad made once (`slime-scatter.ts`) that the vertex shader sizes and switches by the mockup's own tests — a
// golden speck under 7 px, the small bright-field sprite while the dark field has not begun, then the rung of its
// ladder in the diatoms' atlas (`slime-atlases.ts`), in bright and dark field mixed by the dark field — under the halo
// the mockup drew round it, clipped to the drop. GLSL ES 3.00.

import { DIATOM_PLASTID_LIGHT, SILICA_BASE } from '../../constants';
import { SLIME_FLOOR_DIATOMS, SLIME_SPRITE_LADDER } from '../../constants/dive-slime';
import {
  SLIME_COCCONEIS,
  SLIME_DIATOM_KIND,
  SLIME_DIATOM_MODE,
  SLIME_DIATOM_SPRITE,
  SLIME_LICMOPHORA,
  SLIME_PENNATE,
  SLIME_PICTURE_BOXES,
  SLIME_PICTURE_MARGIN_PX,
} from '../../constants/dive-slime-diatoms';
import { glslFloat } from '../../cells/cell-shader-source';
import {
  KELP_FRAGMENT_HEAD,
  KELP_PAINT_SOURCE,
  KELP_TURN_SOURCE,
  KELP_VERTEX_HEAD,
  glslHex,
} from '../kelp/kelp-shader-common';
import { DIATOM_ATLAS_SLOTS, DIATOM_KIND_SLOTS } from './slime-atlases';
import {
  SLIME_COMMON_UNIFORM,
  SLIME_CORNER_ATTRIBUTE,
  SLIME_DROP_SOURCE,
  SLIME_FRAME_SOURCE,
  SLIME_GLOW_SOURCE,
  SLIME_OFF_STAGE,
} from './slime-shader-common';
import { ladderSizes } from './slime-sprite-ladder';

export const SLIME_DIATOM_ATTRIBUTE = {
  /** The diatom's centre (metres), length (metres) and heading (radians). */
  diatom: 'aDiatom',
  /** Its kind, and its sway's phase. */
  kind: 'aDiatomKind',
} as const;

export const SLIME_DIATOM_UNIFORM = {
  atlas: 'uDiatomAtlas',
  /** Each picture's place in the atlas (px), by slot and rung, then the small sprites. */
  entries: 'uDiatomEntries',
} as const;

/** The ladder's rungs, the same for every diatom. */
export const SLIME_DIATOM_RUNGS = ladderSizes(SLIME_SPRITE_LADDER.maxPx.diatoms);
/** Where the small sprites start among the entries. */
export const SLIME_DIATOM_SMALL_ENTRY = DIATOM_ATLAS_SLOTS * SLIME_DIATOM_RUNGS.length;
export const SLIME_DIATOM_ENTRIES = SLIME_DIATOM_SMALL_ENTRY + Object.keys(SLIME_DIATOM_KIND).length;

export { SLIME_DIATOM_MODE };

const float = glslFloat;
const floats = (values: readonly number[]): string => `float[${values.length}](${values.map(float).join(', ')})`;
const ints = (values: readonly number[]): string => `int[${values.length}](${values.join(', ')})`;
const LOOK = SLIME_FLOOR_DIATOMS;
const SPRITE = SLIME_DIATOM_SPRITE;
const KINDS = [SLIME_PICTURE_BOXES.cocconeis, SLIME_PICTURE_BOXES.pennate, SLIME_PICTURE_BOXES.licmophora];
const HALOS = [SLIME_COCCONEIS.halo, SLIME_PENNATE.halo, { radius: 0, base: 0, darkField: 0 }];
const BOXES = `vec4[3](${KINDS.map((box) => `vec4(${[box.left, box.top, box.right, box.bottom].map(float).join(', ')})`).join(', ')})`;
const MODE = SLIME_DIATOM_MODE;
const ATTRIBUTE = SLIME_DIATOM_ATTRIBUTE;
const UNIFORM = SLIME_DIATOM_UNIFORM;
const VIEW = SLIME_COMMON_UNIFORM.view;
const FRAME = SLIME_COMMON_UNIFORM.frame;

export const SLIME_DIATOM_VERTEX_SOURCE = /* glsl */ `${KELP_VERTEX_HEAD}
uniform vec4 ${FRAME};
uniform vec4 ${UNIFORM.entries}[${SLIME_DIATOM_ENTRIES}];
in vec2 ${SLIME_CORNER_ATTRIBUTE};
in vec4 ${ATTRIBUTE.diatom};
in vec4 ${ATTRIBUTE.kind};
flat out vec4 vBright;
flat out vec4 vDark;
flat out vec4 vBox;
flat out vec4 vLook;
out vec2 vLocal;
out vec2 vWorld;
${KELP_TURN_SOURCE}
const float SHARES[3] = ${floats(LOOK.lengthShares)};
const float SPRITE_BELOW[3] = ${floats(SPRITE.spriteBelowPx)};
const float SPRITE_HIDE[3] = ${floats(SPRITE.hideBelowPx)};
const float HALO_RADIUS[3] = ${floats(HALOS.map((halo) => halo.radius))};
const float HALO_BASE[3] = ${floats(HALOS.map((halo) => halo.base))};
const float HALO_DARK[3] = ${floats(HALOS.map((halo) => halo.darkField))};
const vec4 BOXES[3] = ${BOXES};
const float RUNGS[${SLIME_DIATOM_RUNGS.length}] = ${floats(SLIME_DIATOM_RUNGS)};
const int BRIGHT_SLOTS[3] = ${ints(DIATOM_KIND_SLOTS.map(([bright]) => bright))};
const int DARK_SLOTS[3] = ${ints(DIATOM_KIND_SLOTS.map(([, dark]) => dark))};

int rungFor(float sizePx) {
  for (int rung = 0; rung < ${SLIME_DIATOM_RUNGS.length}; rung++) if (RUNGS[rung] >= sizePx) return rung;
  return ${SLIME_DIATOM_RUNGS.length - 1};
}

float extentOf(vec4 box) { return max(max(-box.x, box.z), max(-box.y, box.w)); }

void main() {
  int kind = int(${ATTRIBUTE.kind}.x + 0.5);
  float share = SHARES[kind];
  float lengthPx = ${ATTRIBUTE.diatom}.z * ${VIEW}.z;
  float drawnPx = lengthPx * share;
  float mode = ${float(MODE.hidden)};
  float unitPx = drawnPx;
  int bright = 0;
  int dark = 0;
  if (lengthPx >= ${float(LOOK.hideBelowPx)}) {
    if (lengthPx < ${float(LOOK.dotBelowPx)}) {
      mode = ${float(MODE.dot)};
    } else if (${FRAME}.z <= 0.0 && drawnPx < SPRITE_BELOW[kind]) {
      if (drawnPx >= SPRITE_HIDE[kind]) mode = ${float(MODE.sprite)};
      bright = ${SLIME_DIATOM_SMALL_ENTRY} + kind;
      dark = bright;
      unitPx = ${float(SPRITE.detailPx)};
    } else {
      mode = ${float(MODE.ladder)};
      int rung = rungFor(drawnPx);
      bright = BRIGHT_SLOTS[kind] * ${SLIME_DIATOM_RUNGS.length} + rung;
      dark = DARK_SLOTS[kind] * ${SLIME_DIATOM_RUNGS.length} + rung;
      unitPx = RUNGS[rung];
    }
  }
  float margin = ${float(SLIME_PICTURE_MARGIN_PX)} / unitPx;
  vBox = BOXES[kind] + vec4(-margin, -margin, margin, margin);
  float haloRadius = mode == ${float(MODE.dot)} ? ${float(LOOK.dotRadius)} / share : HALO_RADIUS[kind];
  float reach = max(haloRadius, extentOf(vBox)) + ${float(SLIME_PICTURE_MARGIN_PX)} / max(drawnPx, 1.0);
  float sway = 0.0;
  if (kind == ${SLIME_DIATOM_KIND.licmophora} && mode == ${float(MODE.ladder)}) {
    sway = sin(${FRAME}.x * ${float(SLIME_LICMOPHORA.sway.rate)} + ${ATTRIBUTE.kind}.y) * ${float(SLIME_LICMOPHORA.sway.amount)};
  }
  vLocal = ${SLIME_CORNER_ATTRIBUTE} * reach;
  vWorld = ${ATTRIBUTE.diatom}.xy + turn(vLocal * ${ATTRIBUTE.diatom}.z * share, ${ATTRIBUTE.diatom}.w + sway);
  vBright = ${UNIFORM.entries}[bright];
  vDark = ${UNIFORM.entries}[dark];
  vLook = vec4(mode, haloRadius, HALO_BASE[kind] + HALO_DARK[kind] * ${FRAME}.z, 0.0);
  gl_Position = mode == ${float(MODE.hidden)} ? ${SLIME_OFF_STAGE} : clipOf(vWorld);
}
`;

export const SLIME_DIATOM_FRAGMENT_SOURCE = /* glsl */ `${KELP_FRAGMENT_HEAD}
uniform sampler2D ${UNIFORM.atlas};
flat in vec4 vBright;
flat in vec4 vDark;
flat in vec4 vBox;
flat in vec4 vLook;
in vec2 vLocal;
in vec2 vWorld;
${KELP_PAINT_SOURCE}${SLIME_FRAME_SOURCE}${SLIME_DROP_SOURCE}${SLIME_GLOW_SOURCE}
/** The picture at \`rect\` in the atlas, drawn in \`box\`, at the point \`local\` of the diatom's unit. */
vec4 pictureAt(vec4 rect, vec2 local) {
  vec2 at = (local - vBox.xy) / (vBox.zw - vBox.xy);
  if (any(lessThan(at, vec2(0.0))) || any(greaterThan(at, vec2(1.0)))) return vec4(0.0);
  return texture(${UNIFORM.atlas}, (rect.xy + at * rect.zw) / vec2(textureSize(${UNIFORM.atlas}, 0)));
}

void main() {
  float away = length(vLocal);
  vec4 colour;
  if (vLook.x < ${float(MODE.sprite)}) {
    colour = paint(${glslHex(DIATOM_PLASTID_LIGHT)}, glowAt(away / vLook.y) * ${float(LOOK.dotAlpha)});
  } else {
    colour = vLook.y > 0.0 ? paint(${glslHex(SILICA_BASE)}, glowAt(away / vLook.y) * vLook.z) : vec4(0.0);
    vec4 picture = pictureAt(vBright, vLocal);
    if (vLook.x > ${float(MODE.sprite)}) picture = mix(picture, pictureAt(vDark, vLocal), darkField());
    colour = over(colour, picture);
  }
  fragColour = colour * slimeAlpha() * insideDrop(vWorld);
}
`;
