// @vitest-environment node
// The traced rings in the GLSL (#730, cell-shader-rings.ts): a string until a WebGL context compiles it, so this pins
// what a string can prove: both rings band on the traced curve, never the circle, the lobes are built and stacked as
// `traced-ring.ts` builds them, and the dash is measured along the curve with the circle's arc untouched.
import { describe, expect, it } from 'vitest';
import { RING_TRACE_ARC_SAMPLES, RING_TRACE_SIGMA_WIDENING, WARNING_RING_ROTATION_DEG_PER_SECOND } from '../constants';
import { degreesToRadians } from '../geometry';
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

describe('the traced rings in the cell shader (#730)', () => {
  it('traces both rings round the outline’s arms, banded on the traced curve, never on the circle (#730)', () => {
    for (const body of [functionBody('warningRing'), functionBody('relationLine')]) {
      expect(body).toContain('int count = tracedRingLobes(inst, ');
      expect(body).toContain('band(tracedRingDistance(frame, traced), 0.0, ');
      expect(body).not.toContain('band(frame.len');
    }
    const lobes = CELL_FRAGMENT_SOURCE.slice(CELL_FRAGMENT_SOURCE.indexOf('int tracedRingLobes('));
    expect(lobes).toContain('if (bump.x <= 0.0) continue;');
    expect(lobes).toContain('float coreWu = inst.r * inst.pulse * formAt(inst, delta).x * stretchAt(inst, delta).x;');
    expect(lobes).toContain(`${glslFloat(RING_TRACE_SIGMA_WIDENING)} * log(1.0 + gapCores)`);
    expect(CELL_FRAGMENT_SOURCE).toContain('if (lobes[other].w > lobes[index].w) stack += heights[other];');
    expect(CELL_FRAGMENT_SOURCE.indexOf('int tracedRingLobes(')).toBeLessThan(
      CELL_FRAGMENT_SOURCE.indexOf('vec4 warningRing('),
    );
  });

  it('measures the threat ring’s dash along the traced curve, the circle’s arc unchanged for a round cell (#730)', () => {
    const ring = functionBody('warningRing');
    expect(ring).toContain(
      `float arcWu = (frame.theta - ${glslFloat(degreesToRadians(WARNING_RING_ROTATION_DEG_PER_SECOND))} * uTimeSeconds) * radiusWu;`,
    );
    expect(ring).toContain('float arcPx = (arcWu + tracedRingExtraArc(lobes, count, radiusWu, frame.theta)) * uZoom;');
    expect(CELL_FRAGMENT_SOURCE).toContain('if (count == 0) return 0.0;');
    expect(CELL_FRAGMENT_SOURCE).toContain(`float stepRad = TAU / ${glslFloat(RING_TRACE_ARC_SAMPLES)};`);
    expect(CELL_FRAGMENT_SOURCE).toContain(`for (int index = 0; index < ${RING_TRACE_ARC_SAMPLES}; index++) {`);
  });
});
