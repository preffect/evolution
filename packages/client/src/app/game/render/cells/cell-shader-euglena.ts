// The euglena's eyespot and leading flagellum in pass B (#194, #646; docs/rendering/cells.md §2.4,
// docs/visual-style/motion-and-legibility.md §5.1): `forms/euglena-eyespot.ts` and `forms/euglena-flagellum.ts` term
// for term. Both ride the heading. The eyespot is a red dot over the organelle sprites with a halo that brightens with
// the tier and a pale rim at full LOD; the whip is painted outside the membrane in the cell's rim colour (it is the
// cell's silhouette, §5.1 rule 6), denser down its middle, with a white highlight down its centre at full LOD.

import {
  EUGLENA_FLAGELLUM_AMPLITUDE_RADII,
  EUGLENA_FLAGELLUM_CORE_ALPHA,
  EUGLENA_FLAGELLUM_EDGE_ALPHA,
  EUGLENA_FLAGELLUM_HIGHLIGHT_ALPHA,
  EUGLENA_FLAGELLUM_HIGHLIGHT_SHARE,
  EUGLENA_FLAGELLUM_ROOT_INSET_RADII,
  EUGLENA_FLAGELLUM_ROOT_WIDTH_RADII,
  EUGLENA_FLAGELLUM_TIP_WIDTH_RADII,
  EUGLENA_FLAGELLUM_WAVES,
  EYESPOT_ACROSS_RADII,
  EYESPOT_ALONG_RADII,
  EYESPOT_GLOW_PER_TIER,
  EYESPOT_HALO_ALPHA,
  EYESPOT_HALO_RADII,
  EYESPOT_RADIUS_RADII,
  EYESPOT_RIM_SHARE,
  FORM_ID,
} from '../constants';
import { HALF } from '../geometry';
import { glslFloat } from './cell-shader-source';
import { EYESPOT_DELTA } from './forms/euglena-eyespot';
import { EUGLENA_FLAGELLUM_LENGTH_RADII, EUGLENA_FLAGELLUM_TIP_CAP_RADII } from './forms/euglena-flagellum';
import { SPINDLE_PROFILE } from './forms/spindle-profile';

const SPINDLE_NOSE = SPINDLE_PROFILE.evaluate(0).value;
const LENGTH = glslFloat(EUGLENA_FLAGELLUM_LENGTH_RADII);
const CAP = glslFloat(EUGLENA_FLAGELLUM_TIP_CAP_RADII);

export const CELL_SHADER_EUGLENA = /* glsl */ `
/** The fragment in the heading frame, radii: along the heading and across it (positive toward larger Δ). */
vec2 headingPlace(Instance inst, Frame frame) {
  vec2 axis = vec2(cos(inst.heading), sin(inst.heading));
  return vec2(dot(frame.p, axis), axis.x * frame.p.y - axis.y * frame.p.x) / inst.r;
}

bool isSpindle(Instance inst) { return abs(inst.formId - ${glslFloat(FORM_ID.spindle)}) < HALF; }

/** The red dot toward the nose (euglena-eyespot.ts eyespotPlacement), its halo brighter each tier. */
vec4 eyespot(Instance inst, Frame frame, vec4 acc) {
  if (!isSpindle(inst)) return acc;
  float scale = inst.pulse * stretchAt(inst, ${glslFloat(EYESPOT_DELTA)}).x;
  vec2 centre = vec2(${glslFloat(EYESPOT_ALONG_RADII)}, ${glslFloat(EYESPOT_ACROSS_RADII)}) * scale;
  float away = length(headingPlace(inst, frame) - centre);
  float haloRadius = ${glslFloat(EYESPOT_HALO_RADII)} * inst.pulse;
  if (away > haloRadius) return acc;
  float radius = ${glslFloat(EYESPOT_RADIUS_RADII)} * inst.pulse;
  float pxRadii = frame.aa / inst.r;
  float glow = ${glslFloat(EYESPOT_HALO_ALPHA)} * (1.0 + ${glslFloat(EYESPOT_GLOW_PER_TIER)} * (inst.formTier - 1.0));
  acc = over(acc, uEyespot, (1.0 - smoothstep(radius, haloRadius, away)) * glow);
  acc = over(acc, uEyespot, 1.0 - smoothstep(radius - pxRadii, radius + pxRadii, away));
  float rimHalf = radius * ${glslFloat(EYESPOT_RIM_SHARE)} * HALF;
  return over(acc, uEyespotRim, band(away, radius - rimHalf, rimHalf, pxRadii) * inst.lodBlend);
}

/**
 * How far the fragment at 'place' lies from the whip's centre line, square across it, and the half-width there
 * (euglena-flagellum.ts isOnFlagellum): (distance, half-width), radii. 'offset' is how far along it from its root.
 */
vec2 flagellumDistance(vec2 place, float offset, float beat) {
  float share = min(offset / ${LENGTH}, 1.0);
  float wave = TAU * (${glslFloat(EUGLENA_FLAGELLUM_WAVES)} * share - beat);
  float amplitude = ${glslFloat(EUGLENA_FLAGELLUM_AMPLITUDE_RADII)};
  float across = amplitude * share * sin(wave);
  if (offset > ${LENGTH}) return vec2(length(vec2(offset - ${LENGTH}, place.y - across)), ${CAP});
  float slope = amplitude * (sin(wave) + share * TAU * ${glslFloat(EUGLENA_FLAGELLUM_WAVES)} * cos(wave)) / ${LENGTH};
  float halfWidth = mix(${glslFloat(EUGLENA_FLAGELLUM_ROOT_WIDTH_RADII)}, ${glslFloat(EUGLENA_FLAGELLUM_TIP_WIDTH_RADII)}, share) * HALF;
  return vec2(abs(place.y - across) / sqrt(1.0 + slope * slope), halfWidth);
}

/** The leading whip outside the spindle's membrane, rooted inside its nose, in the cell's rim colour. */
vec4 euglenaFlagellum(Instance inst, Frame frame, vec4 acc) {
  if (!isSpindle(inst) || frame.rho < 1.0) return acc;
  vec2 place = headingPlace(inst, frame);
  float nose = inst.pulse * ${glslFloat(SPINDLE_NOSE)} * stretchAt(inst, 0.0).x;
  float offset = place.x - (nose - ${glslFloat(EUGLENA_FLAGELLUM_ROOT_INSET_RADII)});
  float sideways = ${glslFloat(EUGLENA_FLAGELLUM_AMPLITUDE_RADII + EUGLENA_FLAGELLUM_ROOT_WIDTH_RADII * HALF)};
  if (offset < 0.0 || offset > ${LENGTH} + ${CAP} || abs(place.y) > sideways) return acc;
  vec2 whip = flagellumDistance(place, offset, inst.ciliaPhase);
  float pxRadii = frame.aa / inst.r;
  float cover = 1.0 - smoothstep(whip.y - pxRadii, whip.y + pxRadii, whip.x);
  float core = 1.0 - min(whip.x / whip.y, 1.0);
  acc = over(acc, rimColour(inst), cover * mix(${glslFloat(EUGLENA_FLAGELLUM_EDGE_ALPHA)}, ${glslFloat(EUGLENA_FLAGELLUM_CORE_ALPHA)}, core));
  float highlight = band(whip.x, 0.0, whip.y * ${glslFloat(EUGLENA_FLAGELLUM_HIGHLIGHT_SHARE)}, pxRadii) * inst.lodBlend;
  return over(acc, uWhite, cover * highlight * ${glslFloat(EUGLENA_FLAGELLUM_HIGHLIGHT_ALPHA)});
}
`;
