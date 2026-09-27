// The paramecium's cilia tufts in pass B (#193, #646; docs/visual-style/motion-and-legibility.md §5.1):
// `forms/paramecium-cilia.ts` term for term. A fragment past the slipper's membrane finds its slot along the spacing
// parameter, tests the tufts two slots either side (a tuft bends back across its neighbours' slots), and paints the
// one it lies in: a wash of the cell's rim colour deepest down the middle with fine bright strands (faded out at mid
// LOD), the tip fading like a brush's. The tufts are the slipper's silhouette, so they take the player's colour (#745).

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import {
  CILIA_TUFT_BEAT_SWING_DEG,
  CILIA_TUFT_COUNT,
  CILIA_TUFT_LEAN_DEG,
  CILIA_TUFT_REACH_RADII,
  CILIA_TUFT_RETRACTED_SHARE,
  CILIA_TUFT_ROOT_WIDTH_RADII,
  CILIA_TUFT_SIDE_GAIN,
  CILIA_TUFT_SPEED_LEAN_DEG,
  CILIA_TUFT_STRAND_ALPHA,
  CILIA_TUFT_STRAND_WIDTH_PX,
  CILIA_TUFT_STRANDS,
  CILIA_TUFT_TIP_ALPHA_SHARE,
  CILIA_TUFT_TIP_WIDTH_RADII,
  CILIA_TUFT_WASH_CORE_ALPHA,
  CILIA_TUFT_WASH_EDGE_ALPHA,
  CILIA_TUFT_WAVES_PER_FLANK,
  FORM_ID,
} from '../constants';
import { HALF, SQUARE_DERIVATIVE_FACTOR, degreesToRadians } from '../geometry';
import { glslFloat } from './cell-shader-source';

const TUFT_STEP = RADIANS_PER_FULL_TURN / CILIA_TUFT_COUNT;
const TIP_CAP = CILIA_TUFT_TIP_WIDTH_RADII * HALF;
/** A tuft bends back by up to about two slots at its tip, so a fragment tests the tufts this many slots either side. */
const NEIGHBOUR_SLOTS = 2;

export const CELL_SHADER_FRINGE = /* glsl */ `
/** Tuft 'index' at the cell's beat and speed as (Δ, length in radii, lean) (paramecium-cilia.ts ciliaTuftAt). */
vec3 ciliaTuftAt(float index, float stretch, Instance inst) {
  float parameter = wrapAngle((index + HALF) * ${glslFloat(TUFT_STEP)});
  float beat = TAU * (inst.ciliaPhase - ${glslFloat(CILIA_TUFT_WAVES_PER_FLANK)} * abs(parameter) / (TAU * HALF));
  float retracted = ${glslFloat(CILIA_TUFT_RETRACTED_SHARE)};
  float extension = retracted + (1.0 - retracted) * (HALF + HALF * sin(beat));
  float lean = ${glslFloat(degreesToRadians(CILIA_TUFT_LEAN_DEG))} + ${glslFloat(degreesToRadians(CILIA_TUFT_SPEED_LEAN_DEG))} * inst.k
    + ${glslFloat(degreesToRadians(CILIA_TUFT_BEAT_SWING_DEG))} * cos(beat);
  float side = clamp(${glslFloat(CILIA_TUFT_SIDE_GAIN)} * sin(parameter), -1.0, 1.0);
  return vec3(atan(sin(parameter), stretch * cos(parameter)), ${glslFloat(CILIA_TUFT_REACH_RADII)} * extension, lean * side);
}

/**
 * How deep the fragment lies in 'tuft' (paramecium-cilia.ts isInsideTuft), feathered by 'feather' radii, and where
 * across and along it: (coverage, signed share of the half-width, share of the length). 'place' is (Δ, distance,
 * membrane) in radii; 'across' is square across the bent tuft (the arc distance over tuftArcWidening).
 */
vec3 tuftCoverage(vec3 tuft, vec3 place, float feather) {
  float offset = place.y - place.z;
  float along = min(offset, tuft.y);
  float bend = tan(tuft.z) / ${glslFloat(CILIA_TUFT_REACH_RADII)};
  float centre = tuft.x + atan(bend * along * along / (place.z + along));
  float slope = ${glslFloat(SQUARE_DERIVATIVE_FACTOR)} * bend * along;
  float widening = sqrt(1.0 + slope * slope);
  float across = wrapAngle(place.x - centre) * place.y / widening;
  if (offset > tuft.y) {
    float cap = 1.0 - smoothstep(${glslFloat(TIP_CAP)} - feather, ${glslFloat(TIP_CAP)} + feather, length(vec2(offset - tuft.y, across)));
    return vec3(cap, across / ${glslFloat(TIP_CAP)}, 1.0);
  }
  float halfWidth = mix(${glslFloat(CILIA_TUFT_ROOT_WIDTH_RADII)}, ${glslFloat(CILIA_TUFT_TIP_WIDTH_RADII)}, offset / tuft.y) * HALF;
  return vec3(1.0 - smoothstep(halfWidth - feather, halfWidth + feather, abs(across)), across / halfWidth, offset / tuft.y);
}

/** The strands inside a tuft: 'CILIA_TUFT_STRANDS' px-wide lines along it, at 'share' across its half-width. */
float tuftStrands(float share, float halfWidthRadii, float pxRadii) {
  float strands = ${glslFloat(CILIA_TUFT_STRANDS)};
  float perRadius = strands / (2.0 * max(halfWidthRadii, pxRadii));
  float line = abs(fract((share + 1.0) * strands * HALF) - HALF);
  float halfLine = ${glslFloat(CILIA_TUFT_STRAND_WIDTH_PX)} * HALF * pxRadii * perRadius;
  return 1.0 - smoothstep(halfLine - pxRadii * perRadius, halfLine + pxRadii * perRadius, line);
}

/** The slipper's tufts outside its membrane: the tufts round the nearest slot, the deepest one painted. */
vec4 ciliaTufts(Instance inst, Frame frame, vec4 acc) {
  if (abs(inst.formId - ${glslFloat(FORM_ID.slipper)}) > HALF || frame.rho < 1.0) return acc;
  float membrane = frame.len / frame.rho / inst.r;
  vec3 place = vec3(wrapAngle(frame.theta - inst.heading), frame.len / inst.r, membrane);
  if (place.y - membrane > ${glslFloat(CILIA_TUFT_REACH_RADII + TIP_CAP)}) return acc;
  float stretch = sqrt(slipperShape(inst.formTier).x);
  float slot = floor(atan(stretch * sin(place.x), cos(place.x)) / ${glslFloat(TUFT_STEP)});
  float pxRadii = frame.aa / inst.r;
  vec3 best = vec3(0.0);
  for (int neighbour = -${NEIGHBOUR_SLOTS}; neighbour <= ${NEIGHBOUR_SLOTS}; neighbour++) {
    vec3 cover = tuftCoverage(ciliaTuftAt(slot + float(neighbour), stretch, inst), place, pxRadii);
    if (cover.x > best.x) best = cover;
  }
  float halfWidth = mix(${glslFloat(CILIA_TUFT_ROOT_WIDTH_RADII)}, ${glslFloat(CILIA_TUFT_TIP_WIDTH_RADII)}, best.z) * HALF;
  float core = 1.0 - min(abs(best.y), 1.0);
  float wash = mix(${glslFloat(CILIA_TUFT_WASH_EDGE_ALPHA)}, ${glslFloat(CILIA_TUFT_WASH_CORE_ALPHA)}, core);
  float strands = tuftStrands(best.y, halfWidth, pxRadii) * inst.lodBlend;
  float alpha = mix(wash, ${glslFloat(CILIA_TUFT_STRAND_ALPHA)}, strands);
  float tip = mix(1.0, ${glslFloat(CILIA_TUFT_TIP_ALPHA_SHARE)}, smoothstep(HALF, 1.0, best.z));
  return over(acc, rimColour(inst), best.x * alpha * tip);
}
`;
