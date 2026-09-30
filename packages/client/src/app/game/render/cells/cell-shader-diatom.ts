// The diatom in the cell shader (#195, #646; docs/rendering/cells.md §2.4, docs/visual-style/motion-and-legibility.md
// §5.1): `forms/diatom-pattern.ts` and `forms/diatom-spines.ts` term for term. Pass A lays the valve's 36 striae and
// their pores in `SILICA_LIGHT` over the body, under the organelle sprites; pass B draws the girdle's two lines inside
// the margin and the spines outside the membrane in the cell's rim colour (they are its silhouette, §5.1 rule 6), each
// with a `SILICA_LIGHT` highlight down its centre at full LOD and a bright white tip. All of it turns with the heading.

import {
  DIATOM_FINE_STRIA_ALPHA,
  DIATOM_FINE_STRIA_WIDTH_PX,
  DIATOM_GIRDLE_INNER_ALPHA,
  DIATOM_GIRDLE_INNER_RADII,
  DIATOM_GIRDLE_INNER_WIDTH_PX,
  DIATOM_GIRDLE_OUTER_ALPHA,
  DIATOM_GIRDLE_OUTER_RADII,
  DIATOM_GIRDLE_OUTER_WIDTH_PX,
  DIATOM_PORE_ALPHA,
  DIATOM_PORE_FIRST_RADII,
  DIATOM_PORE_MIN_PX,
  DIATOM_PORE_RADIUS_RADII,
  DIATOM_PORE_ROWS,
  DIATOM_PORE_SPACING_RADII,
  DIATOM_RIB_ALPHA,
  DIATOM_RIB_WIDTH_PX,
  DIATOM_SPINE_COUNT_BY_TIER,
  DIATOM_SPINE_CORE_ALPHA,
  DIATOM_SPINE_EDGE_ALPHA,
  DIATOM_SPINE_HIGHLIGHT_ALPHA,
  DIATOM_SPINE_HIGHLIGHT_SHARE,
  DIATOM_SPINE_REACH_RADII,
  DIATOM_SPINE_ROOT_INSET_RADII,
  DIATOM_SPINE_ROOT_WIDTH_RADII,
  DIATOM_SPINE_TIP_DOT_ALPHA,
  DIATOM_SPINE_TIP_GLOW_ALPHA,
  DIATOM_SPINE_TIP_GLOW_RADII,
  DIATOM_SPINE_TIP_WIDTH_RADII,
  DIATOM_STRIA_END_FEATHER_RADII,
  DIATOM_STRIA_INNER_RADII,
  DIATOM_STRIA_OUTER_RADII,
  FORM_ID,
} from '../constants';
import { glslFloat } from './cell-shader-source';
import { DIATOM_FINE_STRIA_TURN, DIATOM_RIB_COUNT } from './forms/diatom-pattern';
import { DIATOM_SPINE_LENGTH_RADII, DIATOM_SPINE_TIP_CAP_RADII } from './forms/diatom-spines';

const LENGTH = glslFloat(DIATOM_SPINE_LENGTH_RADII);
const CAP = glslFloat(DIATOM_SPINE_TIP_CAP_RADII);
/** The spines' reach test: the tip plus its cap or its glow, whichever is wider. */
const SPINE_OUTER_REACH = DIATOM_SPINE_REACH_RADII + Math.max(DIATOM_SPINE_TIP_CAP_RADII, DIATOM_SPINE_TIP_GLOW_RADII);

export const CELL_SHADER_DIATOM = /* glsl */ `
bool isDiatom(Instance inst) { return abs(inst.formId - ${glslFloat(FORM_ID.diatom)}) < HALF; }

/** The fragment in the valve's frame: the body frame turned so +x is the heading (diatom-pattern.ts ValvePoint). */
vec2 valvePlace(Instance inst, Frame frame) {
  vec2 axis = vec2(cos(inst.heading), sin(inst.heading));
  return vec2(dot(frame.pF, axis), axis.x * frame.pF.y - axis.y * frame.pF.x);
}

/** 1 on a pore of the fine stria nearest 'place' (diatom-pattern.ts nearestPore), feathered one px. */
float valvePore(vec2 place, float radiusPx) {
  float spacing = TAU / ${glslFloat(DIATOM_RIB_COUNT)};
  float fineTurn = ${glslFloat(DIATOM_FINE_STRIA_TURN)} * TAU;
  float angle = (floor((atan(place.y, place.x) - fineTurn) / spacing) + HALF) * spacing + fineTurn;
  float row = clamp(floor((length(place) - ${glslFloat(DIATOM_PORE_FIRST_RADII)}) / ${glslFloat(DIATOM_PORE_SPACING_RADII)} + HALF), 0.0, ${glslFloat(DIATOM_PORE_ROWS - 1)});
  vec2 centre = (${glslFloat(DIATOM_PORE_FIRST_RADII)} + row * ${glslFloat(DIATOM_PORE_SPACING_RADII)}) * vec2(cos(angle), sin(angle));
  float radius = max(${glslFloat(DIATOM_PORE_RADIUS_RADII)}, ${glslFloat(DIATOM_PORE_MIN_PX)} * HALF / radiusPx);
  float pxRadii = 1.0 / radiusPx;
  return 1.0 - smoothstep(radius - pxRadii, radius + pxRadii, length(place - centre));
}

/** The valve's ribs, fine striae and pores in 'SILICA_LIGHT', under the sprites; faded out at mid LOD. */
vec4 diatomValve(Instance inst, Frame frame, float inside, vec4 acc) {
  if (!isDiatom(inst) || inst.lodBlend <= 0.0) return acc;
  vec2 place = valvePlace(inst, frame);
  float rho = length(place);
  float radiusPx = frame.rPx * inst.pulse;
  float feather = ${glslFloat(DIATOM_STRIA_END_FEATHER_RADII)};
  float span = smoothstep(${glslFloat(DIATOM_STRIA_INNER_RADII)} - feather, ${glslFloat(DIATOM_STRIA_INNER_RADII)} + feather, rho)
    * (1.0 - smoothstep(${glslFloat(DIATOM_STRIA_OUTER_RADII)} - feather, ${glslFloat(DIATOM_STRIA_OUTER_RADII)} + feather, rho));
  float angle = atan(place.y, place.x);
  float ribPx = spokeDistancePx(${glslFloat(DIATOM_RIB_COUNT)}, angle, rho * radiusPx);
  float finePx = spokeDistancePx(${glslFloat(DIATOM_RIB_COUNT)}, angle - ${glslFloat(DIATOM_FINE_STRIA_TURN)} * TAU, rho * radiusPx);
  float rib = band(ribPx, 0.0, ${glslFloat(DIATOM_RIB_WIDTH_PX)} * HALF, HALF) * ${glslFloat(DIATOM_RIB_ALPHA)};
  float fine = band(finePx, 0.0, ${glslFloat(DIATOM_FINE_STRIA_WIDTH_PX)} * HALF, HALF) * ${glslFloat(DIATOM_FINE_STRIA_ALPHA)};
  float fade = inside * inst.lodBlend;
  acc = over(acc, uSilicaLight, max(rib, fine) * span * fade);
  return over(acc, uSilicaLight, valvePore(place, radiusPx) * ${glslFloat(DIATOM_PORE_ALPHA)} * fade);
}

/** The girdle's 'SILICA_BASE' and 'SILICA_LIGHT' lines inside the margin, px wide, in the undeformed frame. */
vec4 diatomGirdle(Instance inst, Frame frame, vec4 acc) {
  if (!isDiatom(inst) || inst.lodBlend <= 0.0) return acc;
  float px = frame.aa / (inst.r * inst.pulse);
  float innerLine = band(frame.rho, ${glslFloat(DIATOM_GIRDLE_INNER_RADII)}, ${glslFloat(DIATOM_GIRDLE_INNER_WIDTH_PX)} * HALF * px, px * HALF);
  float outerLine = band(frame.rho, ${glslFloat(DIATOM_GIRDLE_OUTER_RADII)}, ${glslFloat(DIATOM_GIRDLE_OUTER_WIDTH_PX)} * HALF * px, px * HALF);
  acc = over(acc, uSilica, innerLine * ${glslFloat(DIATOM_GIRDLE_INNER_ALPHA)} * inst.lodBlend);
  return over(acc, uSilicaLight, outerLine * ${glslFloat(DIATOM_GIRDLE_OUTER_ALPHA)} * inst.lodBlend);
}

/** Spines at the instance's tier (diatom-spines.ts diatomSpineCount). */
float diatomSpineCount(Instance inst) {
  float counts[${DIATOM_SPINE_COUNT_BY_TIER.length}] = float[${DIATOM_SPINE_COUNT_BY_TIER.length}](${DIATOM_SPINE_COUNT_BY_TIER.map(glslFloat).join(', ')});
  return counts[clamp(int(inst.formTier + HALF) - 1, 0, ${DIATOM_SPINE_COUNT_BY_TIER.length - 1})];
}

/**
 * How deep 'place' (cell frame, radii) lies in the spine at 'angle' over a membrane 'membrane' out (diatom-spines.ts
 * isOnSpine), feathered by 'feather': (coverage, share of the half-width off the axis, distance from the tip, radii).
 */
vec3 spineCoverage(vec2 place, float angle, float membrane, float feather) {
  vec2 axis = vec2(cos(angle), sin(angle));
  float along = dot(place, axis);
  float across = axis.x * place.y - axis.y * place.x;
  float offset = along - (membrane - ${glslFloat(DIATOM_SPINE_ROOT_INSET_RADII)});
  float tip = length(vec2(offset - ${LENGTH}, across));
  if (offset < 0.0) return vec3(0.0, 1.0, tip);
  if (offset > ${LENGTH}) return vec3(1.0 - smoothstep(${CAP} - feather, ${CAP} + feather, tip), across / ${CAP}, tip);
  float halfWidth = mix(${glslFloat(DIATOM_SPINE_ROOT_WIDTH_RADII)}, ${glslFloat(DIATOM_SPINE_TIP_WIDTH_RADII)}, offset / ${LENGTH}) * HALF;
  return vec3(1.0 - smoothstep(halfWidth - feather, halfWidth + feather, abs(across)), across / halfWidth, tip);
}

/** The spines outside the membrane: the nearest spine and its two neighbours, the deepest one painted. */
vec4 diatomSpines(Instance inst, Frame frame, vec4 acc) {
  if (!isDiatom(inst) || frame.rho < 1.0) return acc;
  float membrane = frame.len / frame.rho / inst.r;
  vec2 place = frame.p / inst.r;
  if (length(place) > membrane + ${glslFloat(SPINE_OUTER_REACH)}) return acc;
  float spacing = TAU / diatomSpineCount(inst);
  float slot = floor(wrapAngle(frame.theta - inst.heading) / spacing + HALF);
  float pxRadii = frame.aa / inst.r;
  vec3 best = vec3(0.0, 1.0, 1e9);
  for (int neighbour = -1; neighbour <= 1; neighbour++) {
    vec3 cover = spineCoverage(place, inst.heading + (slot + float(neighbour)) * spacing, membrane, pxRadii);
    if (cover.x > best.x) best = vec3(cover.xy, best.z);
    best.z = min(best.z, cover.z);
  }
  float core = 1.0 - min(abs(best.y), 1.0);
  acc = over(acc, rimColour(inst), best.x * mix(${glslFloat(DIATOM_SPINE_EDGE_ALPHA)}, ${glslFloat(DIATOM_SPINE_CORE_ALPHA)}, core));
  float highlight = band(best.y, 0.0, ${glslFloat(DIATOM_SPINE_HIGHLIGHT_SHARE)}, pxRadii) * inst.lodBlend;
  acc = over(acc, uSilicaLight, best.x * highlight * ${glslFloat(DIATOM_SPINE_HIGHLIGHT_ALPHA)});
  float glow = 1.0 - smoothstep(${CAP}, ${glslFloat(DIATOM_SPINE_TIP_GLOW_RADII)}, best.z);
  acc = over(acc, uWhite, glow * ${glslFloat(DIATOM_SPINE_TIP_GLOW_ALPHA)});
  return over(acc, uWhite, (1.0 - smoothstep(${CAP} - pxRadii, ${CAP} + pxRadii, best.z)) * ${glslFloat(DIATOM_SPINE_TIP_DOT_ALPHA)});
}
`;
