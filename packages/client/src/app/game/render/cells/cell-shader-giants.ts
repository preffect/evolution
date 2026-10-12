// The giants' detail in pass A (#828; docs/ecology/giants.md §3.5.11, docs/visual-style/cells-and-organelles.md §4.1):
// `forms/giant-detail.ts` term for term. The paramecium's oral groove (a dark crease with a lit far wall, from the
// outline's notch back to the mouth) and its two star-shaped contractile vacuoles; the amoeba's one round vacuole; the
// diatom's rings of pores between the valve's ribs. Every mark sits under the organelle sprites and fades out with the
// interior at mid LOD; the vacuoles swell and empty on the room clock.

import { GIANT_SPECIES } from '@evolution/shared';
import {
  DIATOM_PORE_FIRST_RADII,
  DIATOM_PORE_MIN_PX,
  DIATOM_PORE_ROWS,
  DIATOM_PORE_SPACING_RADII,
  GIANT_AMOEBA_VACUOLE,
  GIANT_DIATOM_RING_PORE_ALPHA,
  GIANT_DIATOM_RING_PORE_RADIUS_RADII,
  GIANT_DIATOM_RING_PORE_SPACING_RADII,
  GIANT_MOUTH_ALPHA,
  GIANT_MOUTH_RADIUS_RADII,
  GIANT_ORAL_GROOVE_ALPHA,
  GIANT_ORAL_GROOVE_END,
  GIANT_ORAL_GROOVE_FADE_SHARE,
  GIANT_ORAL_GROOVE_LIP_ALPHA,
  GIANT_ORAL_GROOVE_LIP_WIDTH_PX,
  GIANT_ORAL_GROOVE_MIN_WIDTH_PX,
  GIANT_ORAL_GROOVE_WIDTH_RADII,
  GIANT_PARAMECIUM_VACUOLES,
  GIANT_SPECIES_ID,
  GIANT_VACUOLE_CANALS,
  GIANT_VACUOLE_CANAL_ALPHA,
  GIANT_VACUOLE_CANAL_REACH,
  GIANT_VACUOLE_CANAL_WIDTH_RADII,
  GIANT_VACUOLE_CYCLE_SECONDS,
  GIANT_VACUOLE_EMPTY_SCALE,
  GIANT_VACUOLE_FILL_ALPHA,
  GIANT_VACUOLE_FILL_SHARE,
  GIANT_VACUOLE_RADIUS_RADII,
  GIANT_VACUOLE_RIM_ALPHA,
  GIANT_VACUOLE_RIM_WIDTH_PX,
} from '../constants';
import { HALF } from '../geometry';
import { LIGHT_UNIT_VECTOR } from '../light-direction';
import { glslFloat } from './cell-shader-source';
import { oralGrooveArc } from './forms/giant-detail';

const GROOVE = oralGrooveArc();
const point = (place: { readonly x: number; readonly y: number }): string =>
  `vec2(${glslFloat(place.x)}, ${glslFloat(place.y)})`;
/** A pump as `vec3(x, y, phase)`: the paramecium's two empty half a cycle apart, as a real one's do. */
const pump = (place: { readonly x: number; readonly y: number }, phase: number): string =>
  `vec3(${glslFloat(place.x)}, ${glslFloat(place.y)}, ${glslFloat(phase)})`;
const [FRONT_VACUOLE, REAR_VACUOLE] = GIANT_PARAMECIUM_VACUOLES;
const ALTERNATE_PHASE = HALF;
const SAME_PHASE = 0;

export const CELL_SHADER_GIANTS = /* glsl */ `
bool isGiant(Instance inst, float id) { return abs(inst.giantSpeciesId - id) < HALF; }

/** Inside the membrane and at full LOD: the giants' marks fade with the interior. */
float interiorFade(Instance inst, Frame frame) {
  return (1.0 - smoothstep(-frame.aa, frame.aa, frame.d)) * inst.lodBlend;
}

/** The fragment in the heading frame, in membrane radii: the membrane is the unit circle whatever the outline does. */
vec2 membranePlace(Instance inst, Frame frame) {
  float delta = wrapAngle(frame.theta - inst.heading);
  return frame.rho * vec2(cos(delta), sin(delta));
}

/** 'place' (heading frame, membrane radii) in the cell frame, wu: out along its own direction to the membrane there. */
vec2 giantSlot(Instance inst, vec2 place) {
  float angle = inst.heading + atan(place.y, place.x);
  return length(place) * profileAt(inst, angle).x * vec2(cos(angle), sin(angle));
}

/** A vacuole's radius scale on the room clock (giant-detail.ts vacuoleScale). */
float vacuoleScale(float phase) {
  float cycle = fract(uTimeSeconds / ${glslFloat(GIANT_VACUOLE_CYCLE_SECONDS)} + phase);
  float fill = ${glslFloat(GIANT_VACUOLE_FILL_SHARE)};
  float share = cycle < fill ? cycle / fill : 1.0 - (cycle - fill) / (1.0 - fill);
  return ${glslFloat(GIANT_VACUOLE_EMPTY_SCALE)} + (1.0 - ${glslFloat(GIANT_VACUOLE_EMPTY_SCALE)}) * share;
}

/**
 * One contractile vacuole, 'pump' = (place, phase): a clear bubble with a bright rim, and on the paramecium its
 * collecting canals, spokes round it.
 */
vec4 contractileVacuole(Instance inst, Frame frame, vec3 pump, vec4 acc) {
  float fade = interiorFade(inst, frame);
  vec2 offset = frame.p - giantSlot(inst, pump.xy);
  float scale = vacuoleScale(pump.z + inst.speckleSeed);
  float radius = ${glslFloat(GIANT_VACUOLE_RADIUS_RADII)} * inst.r * scale;
  float separation = length(offset);
  float pxWu = frame.aa;
  if (isGiant(inst, ${glslFloat(GIANT_SPECIES_ID[GIANT_SPECIES.paramecium])})) {
    float reach = ${glslFloat(GIANT_VACUOLE_RADIUS_RADII * GIANT_VACUOLE_CANAL_REACH)} * inst.r;
    float along = clamp((separation - radius) / max(reach - radius, pxWu), 0.0, 1.0);
    float spokePx = spokeDistancePx(${glslFloat(GIANT_VACUOLE_CANALS)}, atan(offset.y, offset.x) - inst.heading, separation * uZoom);
    float halfWidthPx = ${glslFloat(GIANT_VACUOLE_CANAL_WIDTH_RADII)} * radius * uZoom * (1.0 - along);
    float full = 1.0 - (scale - ${glslFloat(GIANT_VACUOLE_EMPTY_SCALE)}) / (1.0 - ${glslFloat(GIANT_VACUOLE_EMPTY_SCALE)});
    float canal = band(spokePx, 0.0, halfWidthPx, 1.0) * step(radius, separation) * (1.0 - step(reach, separation));
    acc = over(acc, uVacuole, canal * full * ${glslFloat(GIANT_VACUOLE_CANAL_ALPHA)} * fade);
  }
  float body = 1.0 - smoothstep(radius - pxWu, radius + pxWu, separation);
  acc = over(acc, uVacuole, body * ${glslFloat(GIANT_VACUOLE_FILL_ALPHA)} * (HALF + HALF * separation / radius) * fade);
  float rim = band(separation, radius, ${glslFloat(GIANT_VACUOLE_RIM_WIDTH_PX)} * HALF * pxWu, pxWu);
  return over(acc, uVacuoleRim, rim * ${glslFloat(GIANT_VACUOLE_RIM_ALPHA)} * fade);
}

/** The oral groove (giant-detail.ts oralGrooveArc): a furrow fading in from the notch, its lit far wall, the mouth. */
vec4 oralGroove(Instance inst, Frame frame, vec4 acc) {
  float fade = interiorFade(inst, frame);
  vec2 place = membranePlace(inst, frame);
  vec2 fromCentre = place - ${point(GROOVE.centre)};
  float share = wrapAngle(atan(fromCentre.y, fromCentre.x) - ${glslFloat(GROOVE.notchAngle)}) / ${glslFloat(GROOVE.sweep)};
  float membranePx = frame.len / max(frame.rho, 1e-4) * uZoom;
  float acrossPx = (length(fromCentre) - ${glslFloat(GROOVE.radius)}) * membranePx;
  float onArc = step(0.0, share) * step(share, 1.0);
  float fadeIn = smoothstep(0.0, ${glslFloat(GIANT_ORAL_GROOVE_FADE_SHARE)}, share);
  float furrowHalfPx = max(${glslFloat(GIANT_ORAL_GROOVE_WIDTH_RADII)} * membranePx, ${glslFloat(GIANT_ORAL_GROOVE_MIN_WIDTH_PX)}) * HALF;
  float furrow = band(acrossPx, 0.0, furrowHalfPx, 1.0) * onArc * fadeIn;
  acc = over(acc, uOutline, furrow * ${glslFloat(GIANT_ORAL_GROOVE_ALPHA)} * fade);
  vec2 outward = normalize(fromCentre);
  vec2 outwardWorld = vec2(outward.x * cos(inst.heading) - outward.y * sin(inst.heading), outward.x * sin(inst.heading) + outward.y * cos(inst.heading));
  float awayFromLight = dot(outwardWorld, ${point(LIGHT_UNIT_VECTOR)}) > 0.0 ? -1.0 : 1.0;
  float lipHalfPx = ${glslFloat(GIANT_ORAL_GROOVE_LIP_WIDTH_PX)} * HALF;
  float lip = band(acrossPx, awayFromLight * (furrowHalfPx + lipHalfPx), lipHalfPx, 1.0) * onArc * fadeIn;
  acc = over(acc, rimColour(inst), lip * ${glslFloat(GIANT_ORAL_GROOVE_LIP_ALPHA)} * fade);
  float mouthPx = length(place - ${point(GIANT_ORAL_GROOVE_END)}) * membranePx;
  float mouthRadiusPx = ${glslFloat(GIANT_MOUTH_RADIUS_RADII)} * membranePx;
  float mouth = 1.0 - smoothstep(mouthRadiusPx - 1.0, mouthRadiusPx + 1.0, mouthPx);
  acc = over(acc, uOutline, mouth * ${glslFloat(GIANT_MOUTH_ALPHA)} * fade);
  return over(acc, rimColour(inst), band(mouthPx, mouthRadiusPx, lipHalfPx, 1.0) * ${glslFloat(GIANT_ORAL_GROOVE_LIP_ALPHA)} * fade);
}

/** The pores round the valve's pore row nearest 'place' (giant-detail.ts ringPoreCount), one every spacing. */
float ringPore(vec2 place, float radiusPx) {
  float row = clamp(floor((length(place) - ${glslFloat(DIATOM_PORE_FIRST_RADII)}) / ${glslFloat(DIATOM_PORE_SPACING_RADII)} + HALF), 0.0, ${glslFloat(DIATOM_PORE_ROWS - 1)});
  float ring = ${glslFloat(DIATOM_PORE_FIRST_RADII)} + row * ${glslFloat(DIATOM_PORE_SPACING_RADII)};
  float count = floor(TAU * ring / ${glslFloat(GIANT_DIATOM_RING_PORE_SPACING_RADII)});
  float spacing = TAU / count;
  float angle = floor(atan(place.y, place.x) / spacing + HALF) * spacing;
  float radius = max(${glslFloat(GIANT_DIATOM_RING_PORE_RADIUS_RADII)}, ${glslFloat(DIATOM_PORE_MIN_PX)} * HALF / radiusPx);
  float pxRadii = 1.0 / radiusPx;
  return 1.0 - smoothstep(radius - pxRadii, radius + pxRadii, length(place - ring * vec2(cos(angle), sin(angle))));
}

/** What the form gains at giant size, by species; nothing on any other cell. */
vec4 giantDetail(Instance inst, Frame frame, vec4 acc) {
  if (inst.giantSpeciesId < HALF || inst.lodBlend <= 0.0) return acc;
  if (isGiant(inst, ${glslFloat(GIANT_SPECIES_ID[GIANT_SPECIES.paramecium])})) {
    acc = oralGroove(inst, frame, acc);
    acc = contractileVacuole(inst, frame, ${pump(FRONT_VACUOLE, SAME_PHASE)}, acc);
    return contractileVacuole(inst, frame, ${pump(REAR_VACUOLE, ALTERNATE_PHASE)}, acc);
  }
  if (isGiant(inst, ${glslFloat(GIANT_SPECIES_ID[GIANT_SPECIES.amoeba])})) {
    return contractileVacuole(inst, frame, ${pump(GIANT_AMOEBA_VACUOLE, SAME_PHASE)}, acc);
  }
  if (!isGiant(inst, ${glslFloat(GIANT_SPECIES_ID[GIANT_SPECIES.diatom])})) return acc;
  float pore = ringPore(valvePlace(inst, frame), frame.rPx * inst.pulse);
  return over(acc, uSilicaLight, pore * ${glslFloat(GIANT_DIATOM_RING_PORE_ALPHA)} * interiorFade(inst, frame));
}
`;
