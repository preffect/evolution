// Pass B of the cell shader (docs/RENDERING.md §2.2, over the organelle sprites): the inner
// edge, the soft rim, the rim light with the outline through it (or the protocell double film),
// the cell wall and the cilia (cell-shader-tells.ts), the glint, the prey-under-film alpha, and
// the tells that snap with the LOD: seat-mark beads on the deformed outline, the own cell's self
// ring and the engulf-warning ring in the undeformed frame. Every membrane band is a band of `d`.

import {
  GLINT_ALPHA,
  GLINT_ANGLE_DEG,
  GLINT_EDGE_PX,
  GLINT_OFFSET_RADII,
  GLINT_RADII_X,
  GLINT_RADII_Y,
  GLINT_ROTATION_DEG,
  INNER_EDGE_ALPHA,
  INNER_EDGE_WIDTH_RADII,
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
} from '../constants';
import { LIGHT_DIRECTION_RADIANS } from '../light-direction';
import { degreesToRadians } from '../geometry';
import { glslFloat } from './cell-shader-source';

const GLINT_ANGLE = degreesToRadians(GLINT_ANGLE_DEG);
const GLINT_ROTATION = degreesToRadians(GLINT_ROTATION_DEG);
const SEAT_MARK_ANCHOR = degreesToRadians(SEAT_MARK_ANCHOR_DEG);
const SELF_RING_ROTATION_RAD_PER_SECOND = degreesToRadians(SELF_RING_ROTATION_DEG_PER_SECOND);
/** Membrane bands in `d / r` around the membrane at 1.00. */
const SOFT_RIM_INNER = SOFT_RIM_INNER_RADII - 1;
const SOFT_RIM_OUTER = SOFT_RIM_OUTER_RADII - 1;
const INNER_EDGE_START = 1 - INNER_EDGE_WIDTH_RADII;

export const CELL_SHADER_MEMBRANE = /* glsl */ `
/** Edge @55 % at the membrane → 0 at 0.89 r: a linear ramp, never a flat band. */
vec4 innerEdge(Instance inst, Frame frame, float inside, vec4 acc) {
  float ramp = clamp((frame.rho - ${glslFloat(INNER_EDGE_START)}) / ${glslFloat(INNER_EDGE_WIDTH_RADII)}, 0.0, 1.0);
  return over(acc, shade(inst, SHADE_EDGE), ramp * ${glslFloat(INNER_EDGE_ALPHA)} * inside);
}

/** Base colour 0.90 → 1.10 r, both ends blurred 8 % r: a separate band from the rim light. */
vec4 softRim(Instance inst, Frame frame, vec4 acc) {
  float blur = ${glslFloat(SOFT_RIM_BLUR_RADII)};
  float lo = ${glslFloat(SOFT_RIM_INNER)};
  float hi = ${glslFloat(SOFT_RIM_OUTER)};
  float mask = smoothstep(lo - blur, lo + blur, frame.dr) * (1.0 - smoothstep(hi - blur, hi + blur, frame.dr));
  return over(acc, baseColour(inst), mask * ${glslFloat(SOFT_RIM_ALPHA)});
}

/** Four stops at t = (1 − cos a) / 2 from the light: white → rim → base → rim, dimmer on the far side. */
vec4 rimLightColour(Instance inst, Frame frame) {
  float t = (1.0 - cos(frame.theta - ${glslFloat(LIGHT_DIRECTION_RADIANS)})) * HALF;
  vec4 stops[4];
  stops[0] = vec4(uWhite, ${glslFloat(RIM_LIGHT_ALPHAS[0])});
  stops[1] = vec4(rimColour(inst), ${glslFloat(RIM_LIGHT_ALPHAS[1])});
  stops[2] = vec4(baseColour(inst), ${glslFloat(RIM_LIGHT_ALPHAS[2])});
  stops[3] = vec4(rimColour(inst), ${glslFloat(RIM_LIGHT_ALPHAS[3])});
  float positions[4] = float[4](${RIM_LIGHT_STOPS.map(glslFloat).join(', ')});
  return rampFour(stops, positions, t);
}

/** The outline's half-width in wu: 'max(0.8 px, 1.2 % r) / 2'. */
float outlineHalfWidth(Instance inst) {
  return max(${glslFloat(OUTLINE_MIN_PX)} / uZoom, ${glslFloat(OUTLINE_WIDTH_RADII)} * inst.r) * HALF;
}

/** The 5 % r band centred on the membrane with the outline hairline through its middle. */
vec4 rimLight(Instance inst, Frame frame, vec4 acc) {
  vec4 colour = rimLightColour(inst, frame);
  float mask = band(frame.dr, 0.0, ${glslFloat(RIM_LIGHT_HALF_WIDTH_RADII)}, frame.aa / inst.r);
  acc = over(acc, colour.rgb * inst.rimBrightness, colour.a * mask);
  float outline = band(frame.d, 0.0, outlineHalfWidth(inst), frame.aa * HALF) * rimDashMask(inst, frame);
  return over(acc, uOutline, outline * ${glslFloat(OUTLINE_ALPHA)});
}

/** The protocell's bilayer: the rim colour on the membrane and white a film gap inside it, one px each. */
vec4 doubleFilm(Instance inst, Frame frame, vec4 acc) {
  float halfPx = frame.aa * HALF;
  float outerFilm = band(frame.d, 0.0, halfPx, halfPx);
  float innerFilm = band(frame.dr, -${glslFloat(PROTOCELL_FILM_GAP_RADII)}, halfPx / inst.r, halfPx / inst.r);
  acc = over(acc, rimColour(inst), outerFilm * ${glslFloat(PROTOCELL_FILM_ALPHA)});
  acc = over(acc, uWhite, innerFilm * ${glslFloat(PROTOCELL_FILM_LIGHT_ALPHA)});
  return over(acc, uOutline, band(frame.d, 0.0, outlineHalfWidth(inst), halfPx) * ${glslFloat(PROTOCELL_OUTLINE_ALPHA)});
}

/** The specular glint just inside the membrane toward the light, undeformed frame like the pools. */
vec4 glint(Instance inst, Frame frame, vec4 acc) {
  vec2 centre = vec2(cos(${glslFloat(GLINT_ANGLE)}), sin(${glslFloat(GLINT_ANGLE)})) * ${glslFloat(GLINT_OFFSET_RADII)};
  vec2 q = frame.p / (inst.r * inst.pulse) - centre;
  float rotation = ${glslFloat(GLINT_ROTATION)};
  vec2 local = vec2(cos(rotation) * q.x + sin(rotation) * q.y, -sin(rotation) * q.x + cos(rotation) * q.y);
  float e = length(local / vec2(${glslFloat(GLINT_RADII_X)}, ${glslFloat(GLINT_RADII_Y)}));
  float edge = ${glslFloat(GLINT_EDGE_PX)} / (frame.rPx * ${glslFloat(GLINT_RADII_Y)});
  return over(acc, uWhite, (1.0 - smoothstep(1.0 - edge, 1.0 + edge, e)) * ${glslFloat(GLINT_ALPHA)});
}

/** 'beadCount' beads on the deformed outline from the light anchor, a white core in a rim halo. */
vec4 seatMark(Instance inst, Frame frame, vec4 acc) {
  if (inst.beadCount < HALF) return acc;
  float spacing = TAU / inst.beadCount;
  float index = floor((frame.theta - ${glslFloat(SEAT_MARK_ANCHOR)}) / spacing + HALF);
  float angle = ${glslFloat(SEAT_MARK_ANCHOR)} + index * spacing;
  vec2 centre = profileAt(inst, angle).x * vec2(cos(angle), sin(angle));
  float dist = length(frame.p - centre);
  float radius = max(${glslFloat(SEAT_MARK_BEAD_RADIUS_FRACTION)} * inst.r, ${glslFloat(SEAT_MARK_BEAD_MIN_PX)} / uZoom);
  float halo = 1.0 - smoothstep(0.0, radius * ${glslFloat(SEAT_MARK_HALO_SCALE)}, dist);
  acc = over(acc, rimColour(inst), halo * ${glslFloat(SEAT_MARK_HALO_ALPHA)});
  float core = 1.0 - smoothstep(radius - frame.aa, radius + frame.aa, dist);
  return over(acc, uWhite, core * ${glslFloat(SEAT_MARK_CORE_ALPHA)});
}

/** The own cell's dashed, slowly rotating ring in the undeformed frame, px-sized with a floor. */
vec4 selfRing(Instance inst, Frame frame, vec4 acc) {
  if (inst.isOwn < HALF) return acc;
  float radiusWu = max(${glslFloat(SELF_RING_RADIUS_FRACTION)} * inst.r, ${glslFloat(SELF_RING_MIN_PX)} / uZoom);
  float ring = band(frame.len, radiusWu, ${glslFloat(SELF_RING_WIDTH_PX)} * HALF / uZoom, frame.aa * HALF);
  float arcPx = (frame.theta - ${glslFloat(SELF_RING_ROTATION_RAD_PER_SECOND)} * uTimeSeconds) * radiusWu * uZoom;
  float mask = ring * dash(arcPx, ${glslFloat(SELF_RING_DASH_PX[0])}, ${glslFloat(SELF_RING_DASH_PX[1])});
  return over(acc, uWhite, mask * ${glslFloat(SELF_RING_ALPHA)});
}

vec4 membranePass(Instance inst, Frame frame) {
  vec4 acc = vec4(0.0);
  if (inst.isFarDot > HALF) return acc;
  float inside = 1.0 - smoothstep(-frame.aa, frame.aa, frame.d);
  if (inst.isProtocell > HALF) {
    acc = doubleFilm(inst, frame, acc);
  } else {
    acc = innerEdge(inst, frame, inside, acc);
    acc = softRim(inst, frame, acc);
    acc = rimLight(inst, frame, acc);
  }
  acc = cellWall(inst, frame, acc);
  acc = cilia(inst, frame, acc);
  acc = glint(inst, frame, acc);
  acc *= inst.passBAlpha;
  acc = seatMark(inst, frame, acc);
  acc = selfRing(inst, frame, acc);
  return warningRing(inst, frame, acc);
}
`;
