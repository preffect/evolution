// What every slime shader shares (docs/rendering/opening-dive.md §4, ticket #803): the kelp band's view, frame and
// painting helpers (`kelp-shader-common.ts`), the drop the slime is clipped to while its edge shows, and the mockup's
// soft glow (`glowSprite`) as a function of the distance from its centre. GLSL ES 3.00, as template strings.

import { glslFloat } from '../../cells/cell-shader-source';
import { SLIME_GLOW } from '../../constants/dive-slime';
import { KELP_COMMON_UNIFORM } from '../kelp/kelp-shader-common';

/** The uniforms every slime shader reads, by name: the kelp band's, and the drop. */
export const SLIME_COMMON_UNIFORM = {
  /** The stage's width and height (css px), css px per metre, and device px per css px. */
  view: KELP_COMMON_UNIFORM.view,
  /** The ambient clock (s), the slime band's fade, the dish's dark field (its band's weight), and the zoom. */
  frame: KELP_COMMON_UNIFORM.frame,
  /** The drop's centre and radius (metres), and 1 while the slime is clipped to it (its edge in view). */
  drop: 'uDrop',
} as const;

/** The resource name every slime shader's uniform group goes under. */
export const SLIME_UNIFORM_GROUP = 'slimeUniforms';

const FRAME = SLIME_COMMON_UNIFORM.frame;
const DROP = SLIME_COMMON_UNIFORM.drop;

/** Shorthands for the frame's lanes. */
export const SLIME_FRAME_SOURCE = /* glsl */ `
float timeSeconds() { return ${FRAME}.x; }
float slimeAlpha() { return ${FRAME}.y; }
float darkField() { return ${FRAME}.z; }
`;

/** The drop the slime is clipped to while its edge shows: the coverage of `world` inside it (needs the paint source). */
export const SLIME_DROP_SOURCE = /* glsl */ `
uniform vec4 ${DROP};
float insideDrop(vec2 world) {
  return ${DROP}.w > 0.5 ? cover(${DROP}.z - length(world - ${DROP}.xy)) : 1.0;
}
`;

/** The mockup's glow sprite: full at the centre, \`middleAlpha\` at \`middleStop\` of the radius, none at the edge. */
export const SLIME_GLOW_SOURCE = /* glsl */ `
float glowAt(float away) {
  if (away >= 1.0) return 0.0;
  if (away < ${glslFloat(SLIME_GLOW.middleStop)}) {
    return mix(1.0, ${glslFloat(SLIME_GLOW.middleAlpha)}, away / ${glslFloat(SLIME_GLOW.middleStop)});
  }
  return mix(${glslFloat(SLIME_GLOW.middleAlpha)}, 0.0, (away - ${glslFloat(SLIME_GLOW.middleStop)}) / ${glslFloat(1 - SLIME_GLOW.middleStop)});
}
`;

/** \`src\` (premultiplied) added to \`dst\`, as Canvas 2D's \`lighter\` composites it. */
export const SLIME_LIGHTER_SOURCE = /* glsl */ `
vec4 lighter(vec4 dst, vec4 src) { return min(dst + src, vec4(1.0)); }
`;

/** A vertex dropped off the stage: a hidden instance's corner. */
export const SLIME_OFF_STAGE = 'vec4(2.0, 2.0, 2.0, 1.0)';

/** A quad's corners for an instance: `±1` each way. */
export const SLIME_CORNER_ATTRIBUTE = 'aCorner';
