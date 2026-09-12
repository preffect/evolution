// The trait tells of pass B (docs/RENDERING.md §2.2, docs/VISUAL-STYLE.md §4): the rigid cell
// wall outside the membrane, the leaning cilia hairs (a flat band at mid LOD), the engulf-warning
// ring in the undeformed frame (VISUAL-STYLE §5) and the absorbed ghost's dashed outline. Every
// membrane band is a band of `d`; the ring tracks the instance's centre and snaps with the LOD.

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
  GHOST_RIM_DASH_PX,
  OUTLINE_ALPHA,
  WARNING_RING_DASH_PX,
  WARNING_RING_ROTATION_DEG_PER_SECOND,
  WARNING_RING_STROKE_PX,
} from '../constants';
import { degreesToRadians } from '../geometry';
import { glslFloat } from './cell-shader-source';

/** Membrane bands in `d / r` around the membrane at 1.00. */
const WALL_INNER = CELL_WALL_INNER_RADII - 1;
const WALL_THICKNESS = CELL_WALL_OUTER_RADII - CELL_WALL_INNER_RADII;
const WALL_HAIRLINE = CELL_WALL_HAIRLINE_RADII - CELL_WALL_INNER_RADII;
const CILIA_REACH = CILIA_OUTER_RADII - 1;
const CILIA_LEAN = degreesToRadians(CILIA_LEAN_DEG);
const CILIA_WAVE = degreesToRadians(CILIA_WAVE_AMPLITUDE_DEG);
const WARNING_RING_ROTATION_RAD_PER_SECOND = degreesToRadians(WARNING_RING_ROTATION_DEG_PER_SECOND);

export const CELL_SHADER_TELLS = /* glsl */ `
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
  float s = abs(fract(inst.ciliaCount * thetaHair / TAU) - HALF) * TAU * frame.len * uZoom / inst.ciliaCount;
  float halfWidth = ${glslFloat(CILIA_WIDTH_PX)} * HALF;
  float hair = 1.0 - smoothstep(halfWidth - HALF, halfWidth + HALF, s);
  float full = hair * ${glslFloat(CILIA_ALPHA)} * fade;
  float flatBand = ${glslFloat(CILIA_MID_ALPHA)} * fade;
  return over(acc, uCilia, mix(flatBand, full, inst.lodBlend));
}

/** The outline goes dashed as the ghost dissolves (VISUAL-STYLE §5 "rim dashes"). */
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
`;
