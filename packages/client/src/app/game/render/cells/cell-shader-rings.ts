// The traced ring of the cell shader (docs/rendering/cells.md §2.2, docs/visual-style/motion-and-legibility.md §5.1
// rule 4, #730): the engulf-warning and relation rings are their circle, or the body offset by the ring's gap along
// its normal wherever that passes the circle, plus a ring lobe over every bump that pushes the membrane out, each lobe riding on
// every broader one, the tallest stack taken; banded by the first-order distance from that curve, and the threat ring's
// dash measured along it from the heading. `traced-ring.ts` is the TypeScript reference, term for term. Generic over
// the profile: the body is whatever `formAt` and `stretchAt` make. A round cell at rest has a flat body scale of exactly
// 1 and no outward bump, so every function returns the circle's own numbers, bit for bit, and its ring is unchanged.

import {
  MAX_SHAPE_BUMPS,
  RING_TRACE_ARC_SAMPLES,
  RING_TRACE_SIGMA_WIDENING,
  RING_TRACE_SLOPE_STEP_RAD,
} from '../constants';
import { HALF } from '../geometry';
import { glslFloat } from './cell-shader-source';

export const CELL_SHADER_RINGS = /* glsl */ `
#define RING_LOBE_SLOTS ${MAX_SHAPE_BUMPS}

/** 'pulse · B · stretch' at 'theta' (x) and its derivative (y): the body's radius over 'r' (traced-ring.ts ringBodyScaleAt). */
vec2 ringBodyScale(Instance inst, float theta) {
  float delta = wrapAngle(theta - inst.heading);
  vec2 form = formAt(inst, delta);
  vec2 stretch = stretchAt(inst, delta);
  return inst.pulse * vec2(form.x * stretch.x, form.y * stretch.x + form.x * stretch.y);
}

/** The body offset out by the ring's gap along its normal, 'r · S + gap · √(1 + (S′/S)²)', never inside the circle. */
float ringBaseValue(Instance inst, float circleWu, float theta) {
  vec2 body = ringBodyScale(inst, theta);
  float slope = body.y / body.x;
  return max(circleWu, inst.r * body.x + (circleWu - inst.r) * sqrt(1.0 + slope * slope));
}

/** What the lobes stand on (traced-ring.ts ringBaseAt): the circle exactly for a round body at most unit size. */
vec2 ringBase(Instance inst, float circleWu, float theta) {
  vec2 body = ringBodyScale(inst, theta);
  if (body.x <= 1.0 && body.y == 0.0) return vec2(circleWu, 0.0);
  float stepRad = ${glslFloat(RING_TRACE_SLOPE_STEP_RAD)};
  float after = ringBaseValue(inst, circleWu, theta + stepRad);
  float before = ringBaseValue(inst, circleWu, theta - stepRad);
  return vec2(ringBaseValue(inst, circleWu, theta), (after - before) / (stepRad + stepRad));
}

/**
 * The ring lobes round a circle 'circleWu' out, packed from 0 (traced-ring.ts ringLobesOf): (height wu, centre, σ
 * widened for the gap from the base, the bump's own σ), one per outward bump; returns how many.
 */
int tracedRingLobes(Instance inst, float circleWu, out vec4 lobes[RING_LOBE_SLOTS]) {
  int count = 0;
  for (int slot = 0; slot < RING_LOBE_SLOTS; slot++) {
    vec3 bump = bumpAt(slot);
    if (bump.x <= 0.0) continue;
    float delta = wrapAngle(bump.y - inst.heading);
    float coreWu = inst.r * inst.pulse * formAt(inst, delta).x * stretchAt(inst, delta).x;
    float gapCores = max((ringBase(inst, circleWu, bump.y).x - coreWu) / coreWu, 0.0);
    float sigma = sqrt(bump.z * bump.z + ${glslFloat(RING_TRACE_SIGMA_WIDENING)} * log(1.0 + gapCores));
    lobes[count] = vec4(coreWu * bump.x, bump.y, sigma, bump.z);
    count++;
  }
  return count;
}

/** 'R(θ)' (x) and 'R′(θ)' (y): the base plus the tallest stack, each lobe with every broader one under it. */
vec2 tracedRingAt(Instance inst, vec4 lobes[RING_LOBE_SLOTS], int count, float circleWu, float theta) {
  vec2 heights[RING_LOBE_SLOTS];
  for (int index = 0; index < count; index++) {
    vec4 lobe = lobes[index];
    float away = wrapAngle(theta - lobe.y);
    float value = lobe.x * exp(-(away * away) / (2.0 * lobe.z * lobe.z));
    heights[index] = vec2(value, -value * (away / (lobe.z * lobe.z)));
  }
  vec2 best = vec2(0.0);
  for (int index = 0; index < count; index++) {
    vec2 stack = heights[index];
    for (int other = 0; other < count; other++) {
      if (lobes[other].w > lobes[index].w) stack += heights[other];
    }
    if (stack.x > best.x) best = stack;
  }
  return ringBase(inst, circleWu, theta) + best;
}

/** The first-order distance from the traced ring, wu: '(|p| − R) / √(1 + (R′/R)²)', exactly '|p| − R' on a circle. */
float tracedRingDistance(Frame frame, vec2 ring) {
  float slope = ring.y / ring.x;
  return (frame.len - ring.x) / sqrt(1.0 + slope * slope);
}

/** '√(R² + R′²) − circle' at 'phi': how much faster than its circle the ring runs there; exactly 0 on the circle. */
float tracedRingExtraElement(Instance inst, vec4 lobes[RING_LOBE_SLOTS], int count, float circleWu, float phi) {
  vec2 ring = tracedRingAt(inst, lobes, count, circleWu, phi);
  if (ring.y == 0.0) return ring.x - circleWu;
  return length(ring) - circleWu;
}

/**
 * The traced ring's extra arc length over its circle's from the heading to 'theta', negative behind it, wu
 * (traced-ring.ts tracedRingExtraArcWu): trapezoids on a fixed grid round the turn, the last step integrated under its
 * straight line; it jumps only at the tail, so a growing arm slides only the dashes between it and the tail.
 */
float tracedRingExtraArc(Instance inst, vec4 lobes[RING_LOBE_SLOTS], int count, float circleWu, float theta) {
  float delta = wrapAngle(theta - inst.heading);
  float direction = delta < 0.0 ? -1.0 : 1.0;
  float span = abs(delta);
  float stepRad = TAU / ${glslFloat(RING_TRACE_ARC_SAMPLES)};
  float extraWu = 0.0;
  float startWu = tracedRingExtraElement(inst, lobes, count, circleWu, inst.heading);
  for (int index = 0; index < ${RING_TRACE_ARC_SAMPLES * HALF}; index++) {
    float reached = float(index) * stepRad;
    if (reached >= span) break;
    float endWu = tracedRingExtraElement(inst, lobes, count, circleWu, inst.heading + direction * (reached + stepRad));
    float covered = min(span - reached, stepRad);
    extraWu += startWu * covered + (endWu - startWu) * covered * covered / (stepRad + stepRad);
    startWu = endWu;
  }
  return direction * extraWu;
}
`;
