// @vitest-environment node
// The traced ring's dash (#730): the threat ring's 6 / 5 px dash runs along the traced curve, so it keeps its length up
// an arm's flank instead of smearing into one long dash. Measured against the true arc length of the traced curve.

import { describe, expect, it } from 'vitest';
import {
  AMOEBA_RING_WU as RING_WU,
  AMOEBA_STATES as STATES,
  AMOEBA_TIERS as TIERS,
  amoebaTerms,
  formTerms,
} from '../../../../testing/amoeba-ring-states';
import { REST_DEFORMATION } from './cell-deformation';
import { wrapAngle } from '../geometry';
import { tracedRingAt, tracedRingExtraArcWu, tracedRingOf, type TracedRing } from './traced-ring';

/** `∫ √(R² + R′²) dθ` from −π to `theta` by fine trapezoids: the true length of the traced curve. */
function trueArcWu(ring: TracedRing, theta: number): number {
  const steps = 20000;
  const step = (theta + Math.PI) / steps;
  let length = 0;
  let previous = 0;
  for (let index = 0; index <= steps; index += 1) {
    const sample = tracedRingAt(ring, -Math.PI + index * step);
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

/** `|measured arc element / true element − 1|` every 0.02 rad round the ring. */
function localDashErrors(ring: TracedRing): number[] {
  const arc = (theta: number) => RING_WU * theta + tracedRingExtraArcWu(ring, theta);
  const tail = wrapAngle((ring.body?.heading ?? 0) + Math.PI);
  const errors: number[] = [];
  for (let theta = -Math.PI + 0.01; theta < Math.PI - 0.01; theta += 0.02) {
    if (Math.abs(wrapAngle(theta - tail)) < DASH_PROBE_STEP * 2) continue;
    const sample = tracedRingAt(ring, theta);
    const measured = (arc(theta + DASH_PROBE_STEP) - arc(theta - DASH_PROBE_STEP)) / (2 * DASH_PROBE_STEP);
    errors.push(Math.abs(measured / Math.hypot(sample.r, sample.derivative) - 1));
  }
  return errors;
}

describe('the dash runs along the traced curve', () => {
  const terms = amoebaTerms(3, { timeSeconds: 0, speedRatio: 0, deformation: REST_DEFORMATION });
  const ring = tracedRingOf(terms, RING_WU);
  const tail = wrapAngle(terms.heading + Math.PI);
  /** The whole extra length: the jump at the tail, where the two halves counted from the heading meet. */
  const totalExtra = tracedRingExtraArcWu(ring, tail - 1e-9) - tracedRingExtraArcWu(ring, tail + 1e-9);
  /** The arc from −π, the extra re-based across the tail seam, so it can be held against the true length. */
  const modelArc = (theta: number) =>
    RING_WU * (theta + Math.PI) +
    tracedRingExtraArcWu(ring, theta) -
    tracedRingExtraArcWu(ring, -Math.PI) +
    (theta >= tail ? totalExtra : 0);

  it.each(TIERS.flatMap((tier) => STATES.map((entry) => ({ tier, ...entry }))))(
    'tier $tier, $name: the dash keeps its length along the curve, within 5 % but at a notch’s kink',
    ({ tier, state }) => {
      const errors = localDashErrors(tracedRingOf(amoebaTerms(tier, state), RING_WU));
      expect(Math.max(...errors), 'the one grid step round a kink').toBeLessThan(KINK_DASH_TOLERANCE);
      const within = errors.filter((error) => error < DASH_TOLERANCE).length / errors.length;
      expect(within).toBeGreaterThan(SMOOTH_SHARE);
    },
  );

  it('and the whole length round the ring to within 1 %', () => {
    const almostRound = Math.PI - 1e-9;
    expect(Math.abs(modelArc(almostRound) / trueArcWu(ring, almostRound) - 1)).toBeLessThan(0.01);
  });

  it('counts from the heading, and jumps only at the tail, where the two halves meet', () => {
    expect(tracedRingExtraArcWu(ring, terms.heading)).toBe(0);
    for (let theta = -Math.PI + 0.01; theta < Math.PI - 0.01; theta += 0.01) {
      const step = tracedRingExtraArcWu(ring, theta + 0.01) - tracedRingExtraArcWu(ring, theta);
      const isAcrossTail = Math.abs(wrapAngle(theta + 0.005 - tail)) < 0.01;
      if (!isAcrossTail) expect(Math.abs(step), `θ ${theta.toFixed(2)}`).toBeLessThan(RING_WU);
    }
  });

  it('holds every dash on the far side of the heading still, to 0.01 wu, while an arm grows (the crawl halves)', () => {
    const [arm, ...others] = ring.lobes;
    if (arm === undefined) throw new Error('a tier-III amoeba has lobes');
    const grown = { ...ring, lobes: [{ ...arm, amplitudeWu: arm.amplitudeWu * 1.3 }, ...others] };
    const side = Math.sign(wrapAngle(arm.centre - terms.heading));
    for (let away = 0.05; away < Math.PI - 0.05; away += 0.05) {
      const theta = terms.heading - side * away;
      expect(tracedRingExtraArcWu(grown, theta)).toBeCloseTo(tracedRingExtraArcWu(ring, theta), 2);
    }
  });
});

describe('the dash along a ring only the body shapes (the coarser grid)', () => {
  const bodies = [
    ...TIERS.flatMap((tier) =>
      [0, 1].map((speedRatio) => ({ name: `paramecium tier ${tier} at speed ${speedRatio}`, tier, speedRatio })),
    ),
    { name: 'round blob flat out', tier: 1 as const, speedRatio: 1 },
  ];

  it.each(bodies)('$name: the dash keeps its length along the curve, within 5 % on all but 3 % of it', (body) => {
    const formTraitId = body.name.startsWith('paramecium') ? 'paramecium_cilia' : null;
    const terms = formTerms(formTraitId, body.tier, {
      timeSeconds: 0.5,
      speedRatio: body.speedRatio,
      deformation: REST_DEFORMATION,
    });
    const ring = tracedRingOf(terms, RING_WU);
    expect(ring.lobes).toEqual([]);
    const errors = localDashErrors(ring);
    expect(Math.max(...errors)).toBeLessThan(KINK_DASH_TOLERANCE);
    expect(errors.filter((error) => error < DASH_TOLERANCE).length / errors.length).toBeGreaterThan(SMOOTH_SHARE);
  });
});
