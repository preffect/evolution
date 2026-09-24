// The trait tells of pass B (docs/rendering/cells.md §2.2, docs/visual-style/cells-and-organelles.md §4): the amoeba's
// clear ectoplasm just inside the membrane (#192), the rigid cell wall outside it, the leaning cilia hairs (a flat band at mid LOD), the engulf-warning
// ring in the undeformed frame (visual-style/motion-and-legibility.md §5), the relation ring (docs/ui/hud.md §3.1.5) and
// the absorbed ghost's dashed outline. Every membrane band is a band of `d`; the rings track the instance's centre and
// snap with the LOD.

import {
  CELL_WALL_ALPHA,
  CELL_WALL_HAIRLINE_ALPHA,
  CELL_WALL_HAIRLINE_RADII,
  CELL_WALL_INNER_RADII,
  CELL_WALL_LINE_PX,
  CELL_WALL_OUTER_RADII,
  CILIA_ALPHA,
  CILIA_LEAN_DEG,
  CILIA_MID_ALPHA,
  CILIA_OUTER_RADII,
  CILIA_WAVE_AMPLITUDE_DEG,
  CILIA_WAVE_COUNT,
  CILIA_WIDTH_PX,
  ECTOPLASM_ALPHA,
  ECTOPLASM_DEPTH_RADII,
  FORM_ID,
  EDIBLE_RING_ALPHA,
  GHOST_RIM_DASH_PX,
  OUTLINE_ALPHA,
  RELATION_RING_LINE_PITCH_PX,
  RELATION_RING_STROKE_PX,
  TOXIC_RING_ALPHA,
  WARNING_RING_DASH_PX,
  WARNING_RING_ROTATION_DEG_PER_SECOND,
  WARNING_RING_STROKE_PX,
} from '../constants';
import { degreesToRadians } from '../geometry';
import { glslFloat } from './cell-shader-source';
import { RELATION_RING } from '../../hud/format/relations-for';

/** Membrane bands in `d / r` around the membrane at 1.00. */
const WALL_INNER = CELL_WALL_INNER_RADII - 1;
const WALL_THICKNESS = CELL_WALL_OUTER_RADII - CELL_WALL_INNER_RADII;
const WALL_HAIRLINE = CELL_WALL_HAIRLINE_RADII - CELL_WALL_INNER_RADII;
const CILIA_REACH = CILIA_OUTER_RADII - 1;
const CILIA_LEAN = degreesToRadians(CILIA_LEAN_DEG);
const CILIA_WAVE = degreesToRadians(CILIA_WAVE_AMPLITUDE_DEG);
const WARNING_RING_ROTATION_RAD_PER_SECOND = degreesToRadians(WARNING_RING_ROTATION_DEG_PER_SECOND);

export const CELL_SHADER_TELLS = /* glsl */ `
/** The amoeba's clear ectoplasm: a 'VAC_RIM' band from the membrane inward, fading toward the granular core. */
vec4 ectoplasm(Instance inst, Frame frame, vec4 acc) {
  if (abs(inst.formId - ${glslFloat(FORM_ID.amoeba)}) > HALF) return acc;
  float depth = ${glslFloat(ECTOPLASM_DEPTH_RADII)};
  float feather = frame.aa / inst.r;
  float inside = 1.0 - smoothstep(-feather, feather, frame.dr);
  float fade = smoothstep(-depth, 0.0, frame.dr);
  return over(acc, uEctoplasm, inside * fade * ${glslFloat(ECTOPLASM_ALPHA)});
}

/** The rigid wall band outside the membrane, its hairline and its dark outer line, thickened per tier. */
vec4 cellWall(Instance inst, Frame frame, vec4 acc) {
  if (inst.wallScale <= 0.0) return acc;
  float inner = ${glslFloat(WALL_INNER)};
  float thickness = ${glslFloat(WALL_THICKNESS)} * inst.wallScale;
  float hairline = inner + ${glslFloat(WALL_HAIRLINE)} * inst.wallScale;
  float feather = frame.aa / inst.r;
  float linePx = feather * ${glslFloat(CELL_WALL_LINE_PX)};
  float wallBand = smoothstep(inner - feather, inner + feather, frame.dr) * (1.0 - smoothstep(inner + thickness - feather, inner + thickness + feather, frame.dr));
  acc = over(acc, uCellWall, wallBand * ${glslFloat(CELL_WALL_ALPHA)});
  acc = over(acc, uCellWallLight, band(frame.dr, hairline, linePx, linePx) * ${glslFloat(CELL_WALL_HAIRLINE_ALPHA)});
  return over(acc, uOutline, band(frame.dr, inner + thickness, linePx, linePx) * ${glslFloat(OUTLINE_ALPHA)});
}

/** Leaning hairs rooted on the membrane, the lean modulated by a travelling wave; one flat band at mid LOD. */
vec4 cilia(Instance inst, Frame frame, vec4 acc) {
  if (inst.ciliaCount <= 0.0 || frame.dr < 0.0 || frame.dr > ${glslFloat(CILIA_REACH)}) return acc;
  float fade = 1.0 - frame.dr / ${glslFloat(CILIA_REACH)};
  float wave = ${glslFloat(CILIA_WAVE)} * sin(frame.theta * ${glslFloat(CILIA_WAVE_COUNT)} - TAU * inst.ciliaPhase);
  float thetaHair = frame.theta - frame.dr * tan(${glslFloat(CILIA_LEAN)} + wave);
  float s = spokeDistancePx(inst.ciliaCount, thetaHair, frame.len * uZoom);
  float halfWidth = ${glslFloat(CILIA_WIDTH_PX)} * HALF;
  float hair = band(s, 0.0, halfWidth, HALF);
  float full = hair * ${glslFloat(CILIA_ALPHA)} * fade;
  float flatBand = ${glslFloat(CILIA_MID_ALPHA)} * fade;
  return over(acc, uCilia, mix(flatBand, full, inst.lodBlend));
}

/** The outline goes dashed as the ghost dissolves (visual-style/motion-and-legibility.md §5 "rim dashes"). */
float rimDashMask(Instance inst, Frame frame) {
  float dashed = dash(frame.theta * frame.rPx, ${glslFloat(GHOST_RIM_DASH_PX[0])}, ${glslFloat(GHOST_RIM_DASH_PX[1])});
  return mix(1.0, dashed, inst.rimDash);
}

/** The DANGER ring at 'warningRingPx' in the undeformed frame, dashed and rotating, 'canEngulf' decided it. */
vec4 warningRing(Instance inst, Frame frame, vec4 acc) {
  if (inst.warningRingPx <= 0.0) return acc;
  float radiusWu = inst.warningRingPx / uZoom;
  float ring = band(frame.len, radiusWu, ${glslFloat(WARNING_RING_STROKE_PX)} * HALF / uZoom, frame.aa * HALF);
  float arcPx = (frame.theta - ${glslFloat(WARNING_RING_ROTATION_RAD_PER_SECOND)} * uTimeSeconds) * radiusWu * uZoom;
  return over(acc, uDanger, ring * dash(arcPx, ${glslFloat(WARNING_RING_DASH_PX[0])}, ${glslFloat(WARNING_RING_DASH_PX[1])}));
}

/**
 * The relation ring at 'relationRingPx' in the undeformed frame: solid and still, so it never reads as the dashed,
 * rotating threat ring. One 'GAIN' line on an edible cell; on a toxic one a 'DANGER' double line, the second line one
 * pitch (stroke plus 'TOXIC_RING_LINE_GAP_PX') outside the first. Shape first, colour second (principles-and-palette.md §2).
 */
vec4 relationRing(Instance inst, Frame frame, vec4 acc) {
  if (inst.relationRingPx <= 0.0) return acc;
  float halfStroke = ${glslFloat(RELATION_RING_STROKE_PX)} * HALF / uZoom;
  float feather = frame.aa * HALF;
  float radiusWu = inst.relationRingPx / uZoom;
  float lines = band(frame.len, radiusWu, halfStroke, feather);
  if (inst.relationRingLines < ${glslFloat(RELATION_RING.toxic)} - HALF) return over(acc, uGain, lines * ${glslFloat(EDIBLE_RING_ALPHA)});
  float outerWu = radiusWu + ${glslFloat(RELATION_RING_LINE_PITCH_PX)} / uZoom;
  lines = max(lines, band(frame.len, outerWu, halfStroke, feather));
  return over(acc, uDanger, lines * ${glslFloat(TOXIC_RING_ALPHA)});
}
`;
