// @vitest-environment node
// The traced ring (#730, docs/visual-style/motion-and-legibility.md §5.1 rule 4): measured, not asserted by shape. The
// clearance between the ring and the membrane is the true distance between the two sampled curves, so a ring that
// pinched an arm's flank or cut its tip would read short here whatever its formula says.

import { describe, expect, it } from 'vitest';
import { CELL_STAGE } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import {
  AMOEBA_RING_RADIUS as RADIUS,
  AMOEBA_RING_WU as RING_WU,
  AMOEBA_STATES as STATES,
  AMOEBA_TIERS as TIERS,
  amoebaTerms,
} from '../../../../testing/amoeba-ring-states';
import { clearance, membraneOf, polyline, ringPolyline } from '../../../../testing/ring-clearance';
import {
  CELL_QUAD_EXTENT_RADII,
  PSEUDOPOD_REACH,
  RING_TRACE_SIGMA_WIDENING,
  WARNING_RING_STROKE_PX,
} from '../constants';
import { degreesToRadians } from '../geometry';
import { REST_DEFORMATION } from './cell-deformation';
import { restingDrawState } from './cell-draw-extent';
import { quadExtentRadii } from './cell-instance-builder';
import { cellLodFor } from './cell-lod';
import { summariseCellTraits } from './cell-traits';
import { buildShapeTerms, type ShapeTerms } from './shape-terms';
import {
  tracedRingAt,
  tracedRingExtraArcWu,
  tracedRingOf,
  widenedRingSigma,
  type RingLobe,
  type TracedRing,
} from './traced-ring';
import { peakRingLobeRadii, ringBodyPeak, ringLobeReachRadii } from './traced-ring-reach';

type Point = readonly [number, number];

const MEMBRANE_SAMPLES = 2048;
/** The share of the round cell's own gap an arm may take off the ring's clearance: the membrane's rest terms. */
const CLEARANCE_SHARE = 0.9;

/** A bare circle of `circleWu` with these lobes: the lobe geometry alone. */
const bareRing = (lobes: readonly RingLobe[], circleWu = RING_WU): TracedRing => ({ circleWu, body: null, lobes });

/** The same membrane with no outward bump: the round cell whose gap the circle keeps. */
function withoutOutwardBumps(terms: ShapeTerms): ShapeTerms {
  return { ...terms, bumps: terms.bumps.map((bump) => ({ ...bump, amplitude: Math.min(bump.amplitude, 0) })) };
}

/** A ring point this far past its body-scaled circle counts as under a lobe. */
const LOBE_REGION_WU = 0.01 * RADIUS;

/** The ring's points under a lobe: where an arm could pinch the ring, and where the circle would cut it. */
function pointsUnderLobes(points: readonly Point[], ring: TracedRing): Point[] {
  const withoutLobes = { ...ring, lobes: [] };
  return points.filter((point) => {
    const theta = Math.atan2(point[1], point[0]);
    return tracedRingAt(ring, theta).r - tracedRingAt(withoutLobes, theta).r > LOBE_REGION_WU;
  });
}

describe('the traced ring keeps its gap round the amoeba’s arms (#730)', () => {
  it.each(TIERS.flatMap((tier) => STATES.map((entry) => ({ tier, ...entry }))))(
    'tier $tier, $name: under every arm the ring clears the membrane by the round cell’s own gap there',
    ({ tier, state }) => {
      const terms = amoebaTerms(tier, state);
      const ring = tracedRingOf(terms, RING_WU);
      const membrane = membraneOf(terms);
      const roundMembrane = membraneOf(withoutOutwardBumps(terms));
      const circle = ringPolyline({ ...ring, lobes: [] });
      const tracedRing = ringPolyline(ring);
      const traced = pointsUnderLobes(tracedRing, ring);
      expect(traced.length).toBeGreaterThan(0);
      const roundGap = clearance(pointsUnderLobes(circle, ring), roundMembrane);
      expect(clearance(traced, membrane)).toBeGreaterThanOrEqual(roundGap * CLEARANCE_SHARE);
      const roundAll = clearance(circle, roundMembrane);
      expect(clearance(tracedRing, membrane), 'and all the way round').toBeGreaterThanOrEqual(
        roundAll - (1 - CLEARANCE_SHARE) * (RING_WU - RADIUS),
      );
    },
  );

  it('is needed: the plain circle touches every tier’s arms, and an unwidened lobe pinches their flanks', () => {
    const gap = RING_WU - RADIUS;
    for (const tier of TIERS) {
      const terms = amoebaTerms(tier, { timeSeconds: 0, speedRatio: 0, deformation: REST_DEFORMATION });
      const membrane = membraneOf(terms);
      expect(
        clearance(
          polyline(() => RING_WU),
          membrane,
        ),
        `tier ${tier} circle`,
      ).toBeLessThan(gap * CROSSING_SHARE);
      const ring = tracedRingOf(terms, RING_WU);
      const unwidened = { ...ring, lobes: ring.lobes.map((lobe) => ({ ...lobe, sigma: lobe.breadth })) };
      expect(clearance(ringPolyline(unwidened), membrane), `tier ${tier} unwidened`).toBeLessThan(gap * HALF_GAP);
    }
  });

  it('stacks an arm on a broader swell under it, and leaves a notch between two arms of one width', () => {
    const arm = (centre: number) => ({ amplitudeWu: 10, centre, sigma: 0.3, breadth: 0.15 });
    const swell = { amplitudeWu: 6, centre: 0, sigma: 0.8, breadth: 0.7 };
    expect(tracedRingAt(bareRing([arm(0), swell]), 0).r).toBeCloseTo(RING_WU + 16, 9);
    const pair = bareRing([arm(-0.26), arm(0.26)]);
    const between = tracedRingAt(pair, 0).r;
    expect(between).toBeLessThan(tracedRingAt(pair, 0.26).r);
    expect(between).toBeCloseTo(RING_WU + 10 * Math.exp(-(0.26 * 0.26) / (2 * 0.09)), 9);
  });
});

/** A curve this close to the membrane touches or crosses it: the sampled distance between crossing curves. */
const CROSSING_SHARE = 0.05;
const HALF_GAP = 0.5;
describe('the widened σ (RING_TRACE_SIGMA_WIDENING)', () => {
  const widthCases = [7.5, 10, 12].flatMap((sigmaDeg) =>
    [0.62, PSEUDOPOD_REACH, 1.2].flatMap((amplitude) =>
      [0.1, 0.3, 0.6, 1.4].map((gap) => ({ sigmaDeg, amplitude, gap })),
    ),
  );

  it.each(widthCases)(
    'a lone σ $sigmaDeg ° lobe of height $amplitude r keeps 97 % of a $gap r gap all the way round',
    ({ sigmaDeg, amplitude, gap }) => {
      const sigma = degreesToRadians(sigmaDeg);
      const membrane = polyline(
        (theta) => RADIUS * (1 + amplitude * Math.exp(-(theta * theta) / (2 * sigma * sigma))),
        MEMBRANE_SAMPLES,
      );
      const lobe = { amplitudeWu: RADIUS * amplitude, centre: 0, sigma: widenedRingSigma(sigma, gap), breadth: sigma };
      const ringWu = RADIUS * (1 + gap);
      expect(clearance(ringPolyline(bareRing([lobe], ringWu)), membrane) / RADIUS).toBeGreaterThanOrEqual(gap * 0.97);
    },
  );

  it('widens by the fitted log of the gap, and not at all for a ring on the membrane', () => {
    expect(widenedRingSigma(0.2, 0)).toBe(0.2);
    expect(widenedRingSigma(0.2, 0.3)).toBeCloseTo(Math.sqrt(0.04 + RING_TRACE_SIGMA_WIDENING * Math.log(1.3)), 12);
    expect(widenedRingSigma(0.2, -0.1), 'a stretched core past the ring').toBe(0.2);
  });
});

describe('a round cell’s ring is its circle, exactly', () => {
  it('at rest: no lobe, no body scale, no slope and no extra arc when no bump pushes the membrane out', () => {
    const dented = { amplitude: -0.1, centre: 0.5, sigma: 0.3 };
    const view = createTestCellView({ radius: RADIUS, stage: CELL_STAGE.prokaryote });
    const terms = buildShapeTerms({
      view,
      traits: summariseCellTraits(view),
      timeSeconds: 1,
      speedRatio: 0,
      heading: 0,
      phase: 0,
      stripRow: 0,
      strip: null,
      deformation: { ...REST_DEFORMATION, bumps: [dented] },
    });
    const ring = tracedRingOf(terms, RING_WU);
    expect(ring.lobes).toEqual([]);
    for (let theta = -Math.PI; theta <= Math.PI; theta += 0.01) {
      expect(tracedRingAt(ring, theta)).toEqual({ r: RING_WU, derivative: 0 });
      expect(Math.abs(tracedRingExtraArcWu(ring, theta))).toBe(0);
    }
    expect(ringLobeReachRadii(terms)).toBe(0);
    expect(ringBodyPeak(terms)).toBe(1);
  });
});

describe('the ring lobes’ reach', () => {
  it('is the tallest outward bump on its core, and bounded by the peak over any frame', () => {
    const traits = summariseCellTraits(
      createTestCellView({ radius: RADIUS, traits: [{ traitId: 'amoeba_pseudopods', tier: 3 }] }),
    );
    const peak = peakRingLobeRadii(traits, restingDrawState(1));
    for (const { state } of STATES.filter(({ name }) => !name.startsWith('engulfing'))) {
      const terms = amoebaTerms(3, state);
      const reach = ringLobeReachRadii(terms);
      expect(reach).toBeGreaterThan(0);
      expect(reach).toBeLessThanOrEqual(peak);
      const ring = tracedRingOf(terms, RING_WU);
      const widest = Math.max(...ring.lobes.map((lobe) => tracedRingAt(bareRing(ring.lobes), lobe.centre).r));
      expect(widest).toBeLessThanOrEqual(RING_WU + reach * RADIUS + 1e-9);
      expect(widest).toBeGreaterThan(RING_WU + reach * RADIUS * 0.99);
    }
  });

  it('is zero for a blob at rest, so its labels and cull are unchanged', () => {
    const traits = summariseCellTraits(createTestCellView({ radius: RADIUS, stage: CELL_STAGE.prokaryote }));
    expect(peakRingLobeRadii(traits, restingDrawState(1))).toBe(0);
  });
});

describe('the quad a traced ring needs', () => {
  it('grows past a ring traced round an amoeba’s arms, to its tallest lobe, past the 3 r floor', () => {
    const terms = amoebaTerms(3, { timeSeconds: 0.9, speedRatio: 0, deformation: REST_DEFORMATION });
    // A ring pushed out to 2.5 r, as its px floor pushes it on a small cell: the traced ring then outgrows the floor.
    const ringPx = 2.5 * RADIUS;
    const lod = cellLodFor(RADIUS);
    const extent = quadExtentRadii(terms, lod, { warningRingPx: ringPx, relationRingPx: 0, relationRingLines: 0 });
    expect(ringLobeReachRadii(terms)).toBeGreaterThan(0);
    expect(extent).toBeGreaterThan(CELL_QUAD_EXTENT_RADII);
    const ringRadii = ((ringPx + WARNING_RING_STROKE_PX) / RADIUS) * ringBodyPeak(terms);
    expect(extent).toBeCloseTo(ringRadii + ringLobeReachRadii(terms), 9);
    const ring = tracedRingOf(terms, ringPx);
    for (let theta = -Math.PI; theta < Math.PI; theta += 0.01) {
      expect(tracedRingAt(ring, theta).r + WARNING_RING_STROKE_PX).toBeLessThanOrEqual(extent * RADIUS);
    }
  });
});
