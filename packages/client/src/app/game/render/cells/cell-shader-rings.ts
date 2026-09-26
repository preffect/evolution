// The traced ring of the cell shader (docs/rendering/cells.md §2.2, docs/visual-style/motion-and-legibility.md §5.1
// rule 4, #730): the engulf-warning and relation rings are their circle plus a ring lobe over every bump that pushes
// the membrane out, each lobe riding on every broader one, the tallest stack taken; banded by the first-order distance
// from that curve, and the threat ring's dash measured along it. `traced-ring.ts` is the TypeScript reference, term for
// term. Generic over the profile: a lobe's core is whatever `formAt` and `stretchAt` make under it. With no outward
// bump every function returns the circle's own numbers, bit for bit, so a round cell's ring is unchanged.

import { MAX_SHAPE_BUMPS, RING_TRACE_ARC_SAMPLES, RING_TRACE_SIGMA_WIDENING } from '../constants';
import { glslFloat } from './cell-shader-source';

export const CELL_SHADER_RINGS = /* glsl */ `
#define RING_LOBE_SLOTS ${MAX_SHAPE_BUMPS}

/**
 * The ring lobes of a ring 'ringWu' out, packed from 0 (traced-ring.ts ringLobesOf): (height wu, centre, σ widened for
 * the gap, the bump's own σ), one per outward bump; returns how many.
 */
int tracedRingLobes(Instance inst, float ringWu, out vec4 lobes[RING_LOBE_SLOTS]) {
  int count = 0;
  for (int slot = 0; slot < RING_LOBE_SLOTS; slot++) {
    vec3 bump = bumpAt(slot);
    if (bump.x <= 0.0) continue;
    float delta = wrapAngle(bump.y - inst.heading);
    float coreWu = inst.r * inst.pulse * formAt(inst, delta).x * stretchAt(inst, delta).x;
    float gapCores = max((ringWu - coreWu) / coreWu, 0.0);
    float sigma = sqrt(bump.z * bump.z + ${glslFloat(RING_TRACE_SIGMA_WIDENING)} * log(1.0 + gapCores));
    lobes[count] = vec4(coreWu * bump.x, bump.y, sigma, bump.z);
    count++;
  }
  return count;
}

/** 'R(θ)' (x) and 'R′(θ)' (y): the circle plus the tallest stack, each lobe with every broader one under it. */
vec2 tracedRingAt(vec4 lobes[RING_LOBE_SLOTS], int count, float ringWu, float theta) {
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
  return vec2(ringWu + best.x, best.y);
}

/** The first-order distance from the traced ring, wu: '(|p| − R) / √(1 + (R′/R)²)', exactly '|p| − R' on a circle. */
float tracedRingDistance(Frame frame, vec2 ring) {
  float slope = ring.y / ring.x;
  return (frame.len - ring.x) / sqrt(1.0 + slope * slope);
}

/** '√(R² + R′²) − ring' at 'phi': how much faster than its circle the traced ring runs there. */
float tracedRingExtraElement(vec4 lobes[RING_LOBE_SLOTS], int count, float ringWu, float phi) {
  vec2 ring = tracedRingAt(lobes, count, ringWu, phi);
  return length(ring) - ringWu;
}

/**
 * The traced ring's extra arc length from −π to 'theta' over its circle's, wu (traced-ring.ts tracedRingExtraArcWu):
 * trapezoids on a fixed grid round the turn, the last step integrated under its straight line; 0 with no lobe.
 */
float tracedRingExtraArc(vec4 lobes[RING_LOBE_SLOTS], int count, float ringWu, float theta) {
  if (count == 0) return 0.0;
  float stepRad = TAU / ${glslFloat(RING_TRACE_ARC_SAMPLES)};
  float extraWu = 0.0;
  float startWu = tracedRingExtraElement(lobes, count, ringWu, -TAU * HALF);
  for (int index = 0; index < ${RING_TRACE_ARC_SAMPLES}; index++) {
    float phi = -TAU * HALF + float(index) * stepRad;
    if (phi >= theta) break;
    float endWu = tracedRingExtraElement(lobes, count, ringWu, phi + stepRad);
    float covered = min(theta - phi, stepRad);
    extraWu += startWu * covered + (endWu - startWu) * covered * covered / (stepRad + stepRad);
    startWu = endWu;
  }
  return extraWu;
}
`;
