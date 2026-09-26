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
import { evaluateProfile, type RadialProfileTerms } from './radial-profile';
import { buildShapeTerms, type ShapeTerms } from './shape-terms';
import {
  peakRingLobeRadii,
  ringLobeReachRadii,
  ringLobesOf,
  tracedRingAt,
  tracedRingExtraArcWu,
  widenedRingSigma,
  type RingLobe,
} from './traced-ring';

type Point = readonly [number, number];

const MEMBRANE_SAMPLES = 2048;
const RING_SAMPLES = 512;
/** The share of the round cell's own gap an arm may take off the ring's clearance: the membrane's rest terms. */
const CLEARANCE_SHARE = 0.9;

function polyline(radiusAt: (theta: number) => number, count: number): Point[] {
  return Array.from({ length: count }, (_unused, index) => {
    const theta = -Math.PI + (index / count) * 2 * Math.PI;
    const radius = radiusAt(theta);
    return [radius * Math.cos(theta), radius * Math.sin(theta)] as const;
  });
}

function segmentDistance(point: Point, start: Point, end: Point): number {
  const [deltaX, deltaY] = [end[0] - start[0], end[1] - start[1]];
  const along = ((point[0] - start[0]) * deltaX + (point[1] - start[1]) * deltaY) / (deltaX * deltaX + deltaY * deltaY);
  const share = Math.min(Math.max(along, 0), 1);
  return Math.hypot(start[0] + share * deltaX - point[0], start[1] + share * deltaY - point[1]);
}

/**
 * The least distance from any point of `ring` to the closed polyline `membrane` (sampled evenly in θ from −π): only the
 * segments within `NEAREST_WINDOW_RAD` of the point's angle can be nearest, since the curves are a gap apart.
 */
function clearance(ring: readonly Point[], membrane: readonly Point[]): number {
  const window = Math.ceil((NEAREST_WINDOW_RAD / (2 * Math.PI)) * membrane.length);
  let least = Infinity;
  for (const point of ring) {
    const centre = Math.round(((Math.atan2(point[1], point[0]) + Math.PI) / (2 * Math.PI)) * membrane.length);
    for (let offset = -window; offset <= window; offset += 1) {
      const index = (centre + offset + membrane.length) % membrane.length;
      const next = membrane[(index + 1) % membrane.length] ?? point;
      least = Math.min(least, segmentDistance(point, membrane[index] ?? point, next));
    }
  }
  return least;
}

/** Wider than any angle a gap subtends at the ring (a 0.3 r gap at 1.3 r is 0.23 rad). */
const NEAREST_WINDOW_RAD = 0.6;

function membraneOf(terms: RadialProfileTerms): Point[] {
  return polyline((theta) => evaluateProfile(terms, theta).r, MEMBRANE_SAMPLES);
}

function tracedRingOf(lobes: readonly RingLobe[], ringWu = RING_WU): Point[] {
  return polyline((theta) => tracedRingAt(lobes, ringWu, theta).r, RING_SAMPLES);
}

/** The same membrane with no outward bump: the round cell whose gap the circle keeps today. */
function withoutOutwardBumps(terms: ShapeTerms): ShapeTerms {
  return { ...terms, bumps: terms.bumps.map((bump) => ({ ...bump, amplitude: Math.min(bump.amplitude, 0) })) };
}

/** Whether `theta` is under a ring lobe: where an arm could pinch the ring, and where the circle would cut it. */
function isUnderLobe(lobes: readonly RingLobe[], theta: number): boolean {
  return tracedRingAt(lobes, RING_WU, theta).r - RING_WU > LOBE_REGION_WU;
}

/** A ring point this far past the circle counts as under a lobe. */
const LOBE_REGION_WU = 0.01 * RADIUS;

function pointsUnderLobes(ring: readonly Point[], lobes: readonly RingLobe[]): Point[] {
  return ring.filter((point) => isUnderLobe(lobes, Math.atan2(point[1], point[0])));
}

describe('the traced ring keeps its gap round the amoeba’s arms (#730)', () => {
  it.each(TIERS.flatMap((tier) => STATES.map((entry) => ({ tier, ...entry }))))(
    'tier $tier, $name: under every arm the ring clears the membrane by the round cell’s own gap there',
    ({ tier, state }) => {
      const terms = amoebaTerms(tier, state);
      const lobes = ringLobesOf(terms, RING_WU);
      const membrane = membraneOf(terms);
      const roundMembrane = membraneOf(withoutOutwardBumps(terms));
      const circle = polyline(() => RING_WU, RING_SAMPLES);
      const tracedRing = tracedRingOf(lobes);
      const traced = pointsUnderLobes(tracedRing, lobes);
      expect(traced.length).toBeGreaterThan(0);
      const roundGap = clearance(pointsUnderLobes(circle, lobes), roundMembrane);
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
          polyline(() => RING_WU, RING_SAMPLES),
          membrane,
        ),
        `tier ${tier} circle`,
      ).toBeLessThan(gap * CROSSING_SHARE);
      const unwidened = ringLobesOf(terms, RING_WU).map((lobe) => ({ ...lobe, sigma: lobe.breadth }));
      expect(clearance(tracedRingOf(unwidened), membrane), `tier ${tier} unwidened`).toBeLessThan(gap * HALF_GAP);
    }
  });

  it('stacks an arm on a broader swell under it, and leaves a notch between two arms of one width', () => {
    const arm = (centre: number) => ({ amplitudeWu: 10, centre, sigma: 0.3, breadth: 0.15 });
    const swell = { amplitudeWu: 6, centre: 0, sigma: 0.8, breadth: 0.7 };
    expect(tracedRingAt([arm(0), swell], RING_WU, 0).r).toBeCloseTo(RING_WU + 16, 9);
    const pair = [arm(-0.26), arm(0.26)];
    const between = tracedRingAt(pair, RING_WU, 0).r;
    expect(between).toBeLessThan(tracedRingAt(pair, RING_WU, 0.26).r);
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
      expect(clearance(tracedRingOf([lobe], ringWu), membrane) / RADIUS).toBeGreaterThanOrEqual(gap * 0.97);
    },
  );

  it('widens by the fitted log of the gap, and not at all for a ring on the membrane', () => {
    expect(widenedRingSigma(0.2, 0)).toBe(0.2);
    expect(widenedRingSigma(0.2, 0.3)).toBeCloseTo(Math.sqrt(0.04 + RING_TRACE_SIGMA_WIDENING * Math.log(1.3)), 12);
    expect(widenedRingSigma(0.2, -0.1), 'a stretched core past the ring').toBe(0.2);
  });
});

describe('a round cell’s ring is its circle, exactly', () => {
  it('has no lobe, no slope and no extra arc when no bump pushes the membrane out', () => {
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
    const lobes = ringLobesOf(terms, RING_WU);
    expect(lobes).toEqual([]);
    for (const theta of [-3, -1, 0, 2, Math.PI]) {
      expect(tracedRingAt(lobes, RING_WU, theta)).toEqual({ r: RING_WU, derivative: 0 });
      expect(tracedRingExtraArcWu(lobes, RING_WU, theta)).toBe(0);
    }
    expect(ringLobeReachRadii(terms)).toBe(0);
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
      const lobes = ringLobesOf(terms, RING_WU);
      const widest = Math.max(...lobes.map((lobe) => tracedRingAt(lobes, RING_WU, lobe.centre).r));
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
    expect(extent).toBeCloseTo((ringPx + WARNING_RING_STROKE_PX) / RADIUS + ringLobeReachRadii(terms), 9);
    const lobes = ringLobesOf(terms, ringPx);
    for (let theta = -Math.PI; theta < Math.PI; theta += 0.01) {
      expect(tracedRingAt(lobes, ringPx, theta).r + WARNING_RING_STROKE_PX).toBeLessThanOrEqual(extent * RADIUS);
    }
  });
});
