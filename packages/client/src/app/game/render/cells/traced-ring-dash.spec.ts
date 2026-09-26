// @vitest-environment node
// The traced ring's dash (#730): the threat ring's 6 / 5 px dash runs along the traced curve, so it keeps its length up
// an arm's flank instead of smearing into one long dash. Measured against the true arc length of the traced curve.

import { describe, expect, it } from 'vitest';
import {
  AMOEBA_RING_WU as RING_WU,
  AMOEBA_STATES as STATES,
  AMOEBA_TIERS as TIERS,
  amoebaTerms,
} from '../../../../testing/amoeba-ring-states';
import { REST_DEFORMATION } from './cell-deformation';
import { ringLobesOf, tracedRingAt, tracedRingExtraArcWu, type RingLobe } from './traced-ring';

/** `∫ √(R² + R′²) dθ` from −π to `theta` by fine trapezoids: the true length of the traced curve. */
function trueArcWu(lobes: readonly RingLobe[], theta: number): number {
  const steps = 20000;
  const step = (theta + Math.PI) / steps;
  let length = 0;
  let previous = 0;
  for (let index = 0; index <= steps; index += 1) {
    const sample = tracedRingAt(lobes, RING_WU, -Math.PI + index * step);
    const element = Math.hypot(sample.r, sample.derivative);
    if (index > 0) length += (element + previous) * 0.5 * step;
    previous = element;
  }
  return length;
}

/** How far the dash may stretch or shrink along the arm: 6 px reads 5.7–6.3 px… */
const DASH_TOLERANCE = 0.05;
/** …on all but this share of the ring: where two arms' ring lobes meet in a notch the length element jumps, and the
 * trapezoid grid spreads the jump over one step (≈ 3 px at 1 px/wu), so a dash there runs up to 20 % long or short. */
const SMOOTH_SHARE = 0.97;
const KINK_DASH_TOLERANCE = 0.2;
const DASH_PROBE_STEP = 0.001;

/** `|measured arc element / true element − 1|` every 0.01 rad round the ring. */
function localDashErrors(lobes: readonly RingLobe[]): number[] {
  const arc = (theta: number) => RING_WU * theta + tracedRingExtraArcWu(lobes, RING_WU, theta);
  const errors: number[] = [];
  for (let theta = -Math.PI + 0.01; theta < Math.PI - 0.01; theta += 0.01) {
    const sample = tracedRingAt(lobes, RING_WU, theta);
    const measured = (arc(theta + DASH_PROBE_STEP) - arc(theta - DASH_PROBE_STEP)) / (2 * DASH_PROBE_STEP);
    errors.push(Math.abs(measured / Math.hypot(sample.r, sample.derivative) - 1));
  }
  return errors;
}

describe('the dash runs along the traced curve', () => {
  const terms = amoebaTerms(3, { timeSeconds: 0, speedRatio: 0, deformation: REST_DEFORMATION });
  const lobes = ringLobesOf(terms, RING_WU);
  const modelArc = (theta: number) =>
    RING_WU * (theta + Math.PI) +
    tracedRingExtraArcWu(lobes, RING_WU, theta) -
    tracedRingExtraArcWu(lobes, RING_WU, -Math.PI);

  it.each(TIERS.flatMap((tier) => STATES.map((entry) => ({ tier, ...entry }))))(
    'tier $tier, $name: the dash keeps its length along the curve, within 5 % but at a notch’s kink',
    ({ tier, state }) => {
      const tracedLobes = ringLobesOf(amoebaTerms(tier, state), RING_WU);
      const errors = localDashErrors(tracedLobes);
      expect(Math.max(...errors), 'the one grid step round a kink').toBeLessThan(KINK_DASH_TOLERANCE);
      const within = errors.filter((error) => error < DASH_TOLERANCE).length / errors.length;
      expect(within).toBeGreaterThan(SMOOTH_SHARE);
    },
  );

  it('and the whole length round the ring to within 1 %', () => {
    const almostRound = Math.PI - 1e-9;
    expect(Math.abs(modelArc(almostRound) / trueArcWu(lobes, almostRound) - 1)).toBeLessThan(0.01);
  });

  it('only jumps where θ wraps, as the circle’s arc does', () => {
    for (let theta = -Math.PI + 0.01; theta < Math.PI - 0.01; theta += 0.01) {
      expect(Math.abs(modelArc(theta + 0.01) - modelArc(theta))).toBeLessThan(RING_WU);
    }
    expect(tracedRingExtraArcWu(lobes, RING_WU, -Math.PI)).toBe(0);
  });
});
