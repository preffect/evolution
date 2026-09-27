// @vitest-environment node
// The traced rings in the GLSL (#730, cell-shader-rings.ts): a string until a WebGL context compiles it, so this pins
// what a string can prove: both rings band on the traced curve, never the circle, the lobes are built and stacked as
// `traced-ring.ts` builds them, and the dash is measured along the curve with the circle's arc untouched.
import { describe, expect, it } from 'vitest';
import {
  RING_TRACE_ARC_SAMPLES,
  RING_TRACE_SIGMA_WIDENING,
  RING_TRACE_SLOPE_STEP_RAD,
  WARNING_RING_ROTATION_DEG_PER_SECOND,
} from '../constants';
import { HALF, degreesToRadians } from '../geometry';
import { CELL_FRAGMENT_SOURCE } from './cell-shader';
import { glslFloat } from './cell-shader-source';

/** The body of one GLSL function in the fragment source, from its signature to its closing brace. */
function functionBody(name: string): string {
  const match = new RegExp(`(?:vec4|float) ${name}\\(Instance inst, Frame frame[^)]*\\) \\{([\\s\\S]*?)\\n\\}`).exec(
    CELL_FRAGMENT_SOURCE,
  );
  if (match === null) throw new Error(`${name} is not in the fragment source`);
  return match[1]!;
}

/** The body of the GLSL function whose signature starts `signature`, to its closing brace. */
function glslFunction(signature: string): string {
  const from = CELL_FRAGMENT_SOURCE.indexOf(signature);
  if (from < 0) throw new Error(`${signature} is not in the fragment source`);
  return CELL_FRAGMENT_SOURCE.slice(from, CELL_FRAGMENT_SOURCE.indexOf('\n}', from));
}

describe('the traced rings in the cell shader (#730)', () => {
  it('traces both rings round the body and its lobes, banded on the traced curve, never on the circle', () => {
    for (const body of [functionBody('warningRing'), functionBody('relationLine')]) {
      expect(body).toContain('int count = tracedRingLobes(inst, ');
      expect(body).toContain('vec2 traced = tracedRingAt(inst, lobes, count, radiusWu, frame.theta);');
      expect(body).toContain('band(tracedRingDistance(frame, traced), 0.0, ');
      expect(body).not.toContain('band(frame.len');
    }
    const lobes = glslFunction('int tracedRingLobes(');
    expect(lobes).toContain('if (bump.x <= 0.0) continue;');
    expect(lobes).toContain('float coreWu = inst.r * inst.pulse * formAt(inst, delta).x * stretchAt(inst, delta).x;');
    expect(lobes).toContain('(ringBase(inst, circleWu, bump.y).x - coreWu) / coreWu');
    expect(lobes).toContain(`${glslFloat(RING_TRACE_SIGMA_WIDENING)} * log(1.0 + gapCores)`);
    const traced = glslFunction('vec2 tracedRingAt(');
    expect(traced).toContain('if (lobes[other].w > lobes[index].w) stack += heights[other];');
    expect(traced).toContain('return ringBase(inst, circleWu, theta) + best;');
    expect(CELL_FRAGMENT_SOURCE.indexOf('int tracedRingLobes(')).toBeLessThan(
      CELL_FRAGMENT_SOURCE.indexOf('vec4 warningRing('),
    );
  });

  it('offsets the body by the gap along its normal, and keeps the exact circle for a round body at rest', () => {
    const scale = glslFunction('vec2 ringBodyScale(');
    expect(scale).toContain('float delta = wrapAngle(theta - inst.heading);');
    expect(scale).toContain('return inst.pulse * vec2(form.x * stretch.x, form.y * stretch.x + form.x * stretch.y);');
    const value = glslFunction('float ringBaseValue(');
    expect(value).toContain('return max(circleWu, inst.r * body.x + (circleWu - inst.r) * sqrt(1.0 + slope * slope));');
    const base = glslFunction('vec2 ringBase(');
    expect(base).toContain('if (body.x <= 1.0 && body.y == 0.0) return vec2(circleWu, 0.0);');
    expect(base).toContain(`float stepRad = ${glslFloat(RING_TRACE_SLOPE_STEP_RAD)};`);
    expect(base).toContain(
      'return vec2(ringBaseValue(inst, circleWu, theta), (after - before) / (stepRad + stepRad));',
    );
  });

  it('measures the threat ring’s dash along the traced curve from the heading, the circle’s arc unchanged', () => {
    const ring = functionBody('warningRing');
    expect(ring).toContain(
      `float arcWu = (frame.theta - ${glslFloat(degreesToRadians(WARNING_RING_ROTATION_DEG_PER_SECOND))} * uTimeSeconds) * radiusWu;`,
    );
    expect(ring).toContain(
      'float arcPx = (arcWu + tracedRingExtraArc(inst, lobes, count, radiusWu, frame.theta)) * uZoom;',
    );
    const element = glslFunction('float tracedRingExtraElement(');
    expect(element).toContain('if (ring.y == 0.0) return ring.x - circleWu;');
    expect(element).toContain('return length(ring) - circleWu;');
    const arc = glslFunction('float tracedRingExtraArc(');
    expect(arc).toContain('float delta = wrapAngle(theta - inst.heading);');
    expect(arc).toContain(`float stepRad = TAU / ${glslFloat(RING_TRACE_ARC_SAMPLES)};`);
    expect(arc).toContain('float startWu = tracedRingExtraElement(inst, lobes, count, circleWu, inst.heading);');
    expect(arc).toContain(`for (int index = 0; index < ${RING_TRACE_ARC_SAMPLES * HALF}; index++) {`);
    expect(arc).toContain(
      'float endWu = tracedRingExtraElement(inst, lobes, count, circleWu, inst.heading + direction * (reached + stepRad));',
    );
    expect(arc).toContain(
      'extraWu += startWu * covered + (endWu - startWu) * covered * covered / (stepRad + stepRad);',
    );
    expect(arc).toContain('return direction * extraWu;');
  });
});
