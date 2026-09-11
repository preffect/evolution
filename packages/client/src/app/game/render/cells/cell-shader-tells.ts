// Pass B of the cell shader (docs/RENDERING.md §2.2, over the organelle sprites): the inner edge,
// the soft rim, the rim light with the outline through it (or the protocell double film), the
// cell wall, the cilia, the glint, and the tells that snap with the LOD: seat-mark beads on the
// deformed outline, the own cell's self ring and the engulf-warning ring in the undeformed frame.

import {
  CELL_WALL_HAIRLINE_RADII,
  CELL_WALL_INNER_RADII,
  CELL_WALL_OUTER_RADII,
  CILIA_ALPHA,
  CILIA_LEAN_DEG,
  CILIA_MID_ALPHA,
  CILIA_OUTER_RADII,
  CILIA_WAVE_AMPLITUDE_DEG,
  CILIA_WAVE_COUNT,
  CILIA_WIDTH_PX,
  GLINT_ALPHA,
  GLINT_ANGLE_DEG,
  GLINT_EDGE_PX,
  GLINT_OFFSET_RADII,
  GLINT_RADII_X,
  GLINT_RADII_Y,
  GLINT_ROTATION_DEG,
  INNER_EDGE_ALPHA,
  INNER_EDGE_WIDTH_RADII,
  LIGHT_DIRECTION_DEG,
  OUTLINE_ALPHA,
  OUTLINE_MIN_PX,
  OUTLINE_WIDTH_RADII,
  PROTOCELL_FILM_ALPHA,
  PROTOCELL_FILM_GAP_RADII,
  PROTOCELL_FILM_LIGHT_ALPHA,
  PROTOCELL_OUTLINE_ALPHA,
  RIM_LIGHT_ALPHAS,
  RIM_LIGHT_HALF_WIDTH_RADII,
  RIM_LIGHT_STOPS,
  SEAT_MARK_ANCHOR_DEG,
  SEAT_MARK_BEAD_MIN_PX,
  SEAT_MARK_BEAD_RADIUS_FRACTION,
  SEAT_MARK_CORE_ALPHA,
  SEAT_MARK_HALO_ALPHA,
  SEAT_MARK_HALO_SCALE,
  SELF_RING_ALPHA,
  SELF_RING_DASH_PX,
  SELF_RING_MIN_PX,
  SELF_RING_RADIUS_FRACTION,
  SELF_RING_ROTATION_DEG_PER_SECOND,
  SELF_RING_WIDTH_PX,
  SOFT_RIM_ALPHA,
  SOFT_RIM_BLUR_RADII,
  SOFT_RIM_INNER_RADII,
  SOFT_RIM_OUTER_RADII,
  WARNING_RING_DASH_PX,
  WARNING_RING_ROTATION_DEG_PER_SECOND,
  WARNING_RING_STROKE_PX,
} from '../constants';
import { degreesToRadians } from '../geometry';
import { glslFloat } from './cell-shader-source';

const LIGHT = glslFloat(degreesToRadians(LIGHT_DIRECTION_DEG));

export const CELL_SHADER_TELLS = /* glsl */ `
uniform vec3 uOutline;
uniform vec3 uCilia;
uniform vec3 uCellWall;
uniform vec3 uCellWallLight;
uniform vec3 uDanger;

/** Edge @55 % at the membrane → 0 at 0.89 r: a linear ramp, never a flat band. */
vec4 innerEdge(Instance inst, Frame frame, float inside, vec4 acc) {
  float ramp = clamp((frame.rho - (1.0 - ${glslFloat(INNER_EDGE_WIDTH_RADII)})) / ${glslFloat(INNER_EDGE_WIDTH_RADII)}, 0.0, 1.0);
  return over(acc, shade(inst, SHADE_EDGE), ramp * ${glslFloat(INNER_EDGE_ALPHA)} * inside);
}

vec4 softRim(Instance inst, Frame frame, vec4 acc) {
  float lo = ${glslFloat(SOFT_RIM_INNER_RADII)} - 1.0;
  float hi = ${glslFloat(SOFT_RIM_OUTER_RADII)} - 1.0;
  float blur = ${glslFloat(SOFT_RIM_BLUR_RADII)};
  float mask = smoothstep(lo - blur, lo + blur, frame.dr) * (1.0 - smoothstep(hi - blur, hi + blur, frame.dr));
  return over(acc, baseColour(inst), mask * ${glslFloat(SOFT_RIM_ALPHA)});
}

/** Four stops at t = (1 − cos a) / 2 from the light: white → rim → base → rim, dimmer on the far side. */
vec4 rimLightColour(Instance inst, Frame frame) {
  float a = frame.theta - ${LIGHT};
  float t = (1.0 - cos(a)) * 0.5;
  vec4 stops[4];
  stops[0] = vec4(uWhite, ${glslFloat(RIM_LIGHT_ALPHAS[0])});
  stops[1] = vec4(rimColour(inst), ${glslFloat(RIM_LIGHT_ALPHAS[1])});
  stops[2] = vec4(baseColour(inst), ${glslFloat(RIM_LIGHT_ALPHAS[2])});
  stops[3] = vec4(rimColour(inst), ${glslFloat(RIM_LIGHT_ALPHAS[3])});
  float positions[4] = float[4](${RIM_LIGHT_STOPS.map(glslFloat).join(', ')});
  vec4 colour = stops[0];
  for (int stop = 1; stop < 4; stop++) colour = mix(colour, stops[stop], smoothstep(positions[stop - 1], positions[stop], t));
  return colour;
}

/** The 5 % r band centred on the membrane with the outline hairline through its middle. */
vec4 rimLight(Instance inst, Frame frame, vec4 acc) {
  vec4 colour = rimLightColour(inst, frame);
  float feather = frame.aa / inst.r;
  float mask = band(frame.dr, 0.0, ${glslFloat(RIM_LIGHT_HALF_WIDTH_RADII)}, feather);
  acc = over(acc, colour.rgb * inst.rimBrightness, colour.a * mask);
  float outlineHalf = max(${glslFloat(OUTLINE_MIN_PX)} / uZoom, ${glslFloat(OUTLINE_WIDTH_RADII)} * inst.r) * 0.5;
  float outline = band(frame.d, 0.0, outlineHalf, frame.aa * 0.5);
  float dashed = mix(1.0, dash(frame.theta * frame.rPx, 5.0, 6.0), inst.rimDash);
  return over(acc, uOutline, outline * ${glslFloat(OUTLINE_ALPHA)} * dashed);
}

/** The protocell's bilayer: the rim colour on the membrane and white a film gap inside it, one px each. */
vec4 doubleFilm(Instance inst, Frame frame, vec4 acc) {
  float px = frame.aa;
  float outerFilm = band(frame.d, 0.0, px * 0.5, px * 0.5);
  float innerFilm = band(frame.dr, -${glslFloat(PROTOCELL_FILM_GAP_RADII)}, px * 0.5 / inst.r, px * 0.5 / inst.r);
  acc = over(acc, rimColour(inst), outerFilm * ${glslFloat(PROTOCELL_FILM_ALPHA)});
  acc = over(acc, uWhite, innerFilm * ${glslFloat(PROTOCELL_FILM_LIGHT_ALPHA)});
  float outlineHalf = max(${glslFloat(OUTLINE_MIN_PX)} / uZoom, ${glslFloat(OUTLINE_WIDTH_RADII)} * inst.r) * 0.5;
  return over(acc, uOutline, band(frame.d, 0.0, outlineHalf, frame.aa * 0.5) * ${glslFloat(PROTOCELL_OUTLINE_ALPHA)});
}

/** The rigid wall band outside the membrane, its hairline and its dark outer line, thickened per tier. */
vec4 cellWall(Instance inst, Frame frame, vec4 acc) {
  if (inst.wallScale <= 0.0) return acc;
  float inner = ${glslFloat(CELL_WALL_INNER_RADII)} - 1.0;
  float thickness = (${glslFloat(CELL_WALL_OUTER_RADII)} - ${glslFloat(CELL_WALL_INNER_RADII)}) * inst.wallScale;
  float hairline = inner + (${glslFloat(CELL_WALL_HAIRLINE_RADII)} - ${glslFloat(CELL_WALL_INNER_RADII)}) * inst.wallScale;
  float feather = frame.aa / inst.r;
  float bandMask = smoothstep(inner - feather, inner + feather, frame.dr) * (1.0 - smoothstep(inner + thickness - feather, inner + thickness + feather, frame.dr));
  acc = over(acc, uCellWall, bandMask * 0.8);
  acc = over(acc, uCellWallLight, band(frame.dr, hairline, feather * 0.6, feather * 0.6) * 0.9);
  return over(acc, uOutline, band(frame.dr, inner + thickness, feather * 0.6, feather * 0.6) * ${glslFloat(OUTLINE_ALPHA)});
}

/** Leaning hairs rooted on the membrane, a travelling wave of the lean; one flat band at mid LOD. */
vec4 cilia(Instance inst, Frame frame, vec4 acc) {
  if (inst.ciliaCount <= 0.0) return acc;
  float reach = ${glslFloat(CILIA_OUTER_RADII)} - 1.0;
  if (frame.dr < 0.0 || frame.dr > reach) return acc;
  float fade = 1.0 - frame.dr / reach;
  float wave = ${glslFloat(degreesToRadians(CILIA_WAVE_AMPLITUDE_DEG))} * sin(frame.theta * ${glslFloat(CILIA_WAVE_COUNT)} - TAU * inst.ciliaBeatHz * uTimeSeconds);
  float lean = frame.dr * tan(${glslFloat(degreesToRadians(CILIA_LEAN_DEG))} + wave);
  float thetaHair = frame.theta - lean;
  float s = abs(fract(inst.ciliaCount * thetaHair / TAU) - 0.5) * TAU * frame.len * uZoom / inst.ciliaCount;
  float hair = 1.0 - smoothstep(${glslFloat(CILIA_WIDTH_PX)} * 0.5 - 0.5, ${glslFloat(CILIA_WIDTH_PX)} * 0.5 + 0.5, s);
  float full = hair * ${glslFloat(CILIA_ALPHA)} * fade;
  float flat = ${glslFloat(CILIA_MID_ALPHA)} * fade;
  return over(acc, uCilia, mix(flat, full, inst.lodBlend));
}

/** The specular glint just inside the membrane at the top-left, undeformed frame. */
vec4 glint(Instance inst, Frame frame, vec4 acc) {
  vec2 centre = vec2(cos(${glslFloat(degreesToRadians(GLINT_ANGLE_DEG))}), sin(${glslFloat(degreesToRadians(GLINT_ANGLE_DEG))})) * ${glslFloat(GLINT_OFFSET_RADII)};
  vec2 q = frame.p / (inst.r * inst.pulse) - centre;
  float rotation = ${glslFloat(degreesToRadians(GLINT_ROTATION_DEG))};
  vec2 local = vec2(cos(rotation) * q.x + sin(rotation) * q.y, -sin(rotation) * q.x + cos(rotation) * q.y);
  float e = length(local / vec2(${glslFloat(GLINT_RADII_X)}, ${glslFloat(GLINT_RADII_Y)}));
  float edge = ${glslFloat(GLINT_EDGE_PX)} / (frame.rPx * ${glslFloat(GLINT_RADII_Y)});
  return over(acc, uWhite, (1.0 - smoothstep(1.0 - edge, 1.0 + edge, e)) * ${glslFloat(GLINT_ALPHA)});
}

/** 'beadCount' beads on the deformed outline from the light anchor, core white with a rim halo. */
vec4 seatMark(Instance inst, Frame frame, vec4 acc) {
  if (inst.beadCount < 0.5) return acc;
  float anchor = ${glslFloat(degreesToRadians(SEAT_MARK_ANCHOR_DEG))};
  float spacing = TAU / inst.beadCount;
  float index = floor((frame.theta - anchor) / spacing + 0.5);
  float angle = anchor + index * spacing;
  vec2 centre = profileAt(inst, angle).x * vec2(cos(angle), sin(angle));
  float dist = length(frame.p - centre);
  float radius = max(${glslFloat(SEAT_MARK_BEAD_RADIUS_FRACTION)} * inst.r, ${glslFloat(SEAT_MARK_BEAD_MIN_PX)} / uZoom);
  float halo = 1.0 - smoothstep(0.0, radius * ${glslFloat(SEAT_MARK_HALO_SCALE)}, dist);
  acc = over(acc, rimColour(inst), halo * ${glslFloat(SEAT_MARK_HALO_ALPHA)});
  float core = 1.0 - smoothstep(radius - frame.aa, radius + frame.aa, dist);
  return over(acc, uWhite, core * ${glslFloat(SEAT_MARK_CORE_ALPHA)});
}

/** A dashed, rotating ring in the undeformed frame at 'radiusWu', 'widthPx' thick. */
float dashedRing(Frame frame, float radiusWu, float widthPx, float dashPx, float gapPx, float degreesPerSecond) {
  float ring = band(frame.len, radiusWu, widthPx * 0.5 / uZoom, frame.aa * 0.5);
  float rotation = radians(degreesPerSecond) * uTimeSeconds;
  float arcPx = (frame.theta - rotation) * radiusWu * uZoom;
  return ring * dash(arcPx, dashPx, gapPx);
}

vec4 selfRing(Instance inst, Frame frame, vec4 acc) {
  if (inst.isOwn < 0.5) return acc;
  float radiusWu = max(${glslFloat(SELF_RING_RADIUS_FRACTION)} * inst.r, ${glslFloat(SELF_RING_MIN_PX)} / uZoom);
  float mask = dashedRing(frame, radiusWu, ${glslFloat(SELF_RING_WIDTH_PX)}, ${glslFloat(SELF_RING_DASH_PX[0])}, ${glslFloat(SELF_RING_DASH_PX[1])}, ${glslFloat(SELF_RING_ROTATION_DEG_PER_SECOND)});
  return over(acc, uWhite, mask * ${glslFloat(SELF_RING_ALPHA)});
}

vec4 warningRing(Instance inst, Frame frame, vec4 acc) {
  if (inst.warningRingPx <= 0.0) return acc;
  float mask = dashedRing(frame, inst.warningRingPx / uZoom, ${glslFloat(WARNING_RING_STROKE_PX)}, ${glslFloat(WARNING_RING_DASH_PX[0])}, ${glslFloat(WARNING_RING_DASH_PX[1])}, ${glslFloat(WARNING_RING_ROTATION_DEG_PER_SECOND)});
  return over(acc, uDanger, mask);
}

vec4 membranePass(Instance inst, Frame frame) {
  vec4 acc = vec4(0.0);
  if (inst.isFarDot > 0.5) return acc;
  float inside = 1.0 - smoothstep(-frame.aa, frame.aa, frame.d);
  bool proto = inst.isProtocell > 0.5;
  if (!proto) {
    acc = innerEdge(inst, frame, inside, acc);
    acc = softRim(inst, frame, acc);
    acc = rimLight(inst, frame, acc);
  } else {
    acc = doubleFilm(inst, frame, acc);
  }
  acc = cellWall(inst, frame, acc);
  acc = cilia(inst, frame, acc);
  acc = glint(inst, frame, acc);
  acc *= inst.passBAlpha;
  acc = seatMark(inst, frame, acc);
  acc = selfRing(inst, frame, acc);
  acc = warningRing(inst, frame, acc);
  return acc;
}
`;
