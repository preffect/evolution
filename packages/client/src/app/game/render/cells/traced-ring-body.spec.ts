// @vitest-environment node
// The traced ring round the body (#730, lead ruling on PR #746): wherever the body passes the ring's circle (the
// paramecium's slipper nose, a fast swimmer's stretched front) the ring scales out with it and keeps its gap. Measured
// as the true distance between the sampled ring and membrane, against a round cell's own gap at rest.

import { describe, expect, it } from 'vitest';
import type { TraitId, TraitTier } from '@evolution/shared';
import {
  AMOEBA_RING_RADIUS as RADIUS,
  AMOEBA_RING_WU as RING_WU,
  AMOEBA_TIERS as TIERS,
  formTerms,
  type AmoebaState,
} from '../../../../testing/amoeba-ring-states';
import { clearance, membraneOf, polyline, ringPolyline } from '../../../../testing/ring-clearance';
import { REST_DEFORMATION } from './cell-deformation';
import { tracedRingOf } from './traced-ring';
import { ringBodyPeak } from './traced-ring-reach';

const PARAMECIUM: TraitId = 'paramecium_cilia';
const GAP_WU = RING_WU - RADIUS;
/** The share of a round cell's own rest gap the traced ring must keep: the membrane's rest terms move it a little. */
const CLEARANCE_SHARE = 0.9;
/**
 * The share of the same cell's gap, made round and still with its rest wobble kept, that the ring keeps round a
 * slipper: the wobble rides out with the body, so at the stretched nose it takes up to a quarter of the gap.
 */
const BODY_CLEARANCE_SHARE = 0.75;
/** A curve this close to the membrane touches or crosses it. */
const TOUCHING_SHARE = 0.05;
const HALF_GAP = 0.5;

const resting = (timeSeconds: number): AmoebaState => ({ timeSeconds, speedRatio: 0, deformation: REST_DEFORMATION });
const swimming = (timeSeconds: number): AmoebaState => ({ timeSeconds, speedRatio: 1, deformation: REST_DEFORMATION });
const STATES = [0, 1.4].flatMap((time) => [
  { name: `resting at ${time} s`, state: resting(time) },
  { name: `swimming flat out at ${time} s`, state: swimming(time) },
]);

/** A round blob's own clearance from its 1.3 r circle at rest: the gap every traced ring is held to. */
const roundRestGap = clearance(
  polyline(() => RING_WU),
  membraneOf(formTerms(null, 1, resting(0))),
);

/** The same cell made round and still (no form, no stretch), its rest terms kept: the gap its own wobble leaves. */
function ownRoundGap(formTraitId: TraitId | null, tier: TraitTier, state: AmoebaState): number {
  const terms = formTerms(formTraitId, tier, state);
  const round = { ...terms, form: null, stretch: { ...terms.stretch, k: 0, axialAlong: 1, axialAcross: 1 } };
  return clearance(
    polyline(() => RING_WU),
    membraneOf(round),
  );
}

function tracedClearance(formTraitId: TraitId | null, tier: TraitTier, state: AmoebaState): number {
  const terms = formTerms(formTraitId, tier, state);
  return clearance(ringPolyline(tracedRingOf(terms, RING_WU)), membraneOf(terms));
}

function circleClearance(formTraitId: TraitId | null, tier: TraitTier, state: AmoebaState): number {
  return clearance(
    polyline(() => RING_WU),
    membraneOf(formTerms(formTraitId, tier, state)),
  );
}

describe('the ring scales out round the paramecium’s slipper (#730, #193)', () => {
  it.each(TIERS.flatMap((tier) => STATES.map((entry) => ({ tier, ...entry }))))(
    'tier $tier, $name: the ring clears the slipper, nose and tail included, by its own round gap less the wobble',
    ({ tier, state }) => {
      expect(roundRestGap).toBeGreaterThan(GAP_WU * HALF_GAP);
      const ownGap = ownRoundGap(PARAMECIUM, tier, state);
      expect(tracedClearance(PARAMECIUM, tier, state)).toBeGreaterThanOrEqual(ownGap * BODY_CLEARANCE_SHARE);
      expect(ringBodyPeak(formTerms(PARAMECIUM, tier, state))).toBeGreaterThan(1);
    },
  );

  it('is needed: the plain circle pinches the tier-I nose and the tier-II / III noses cross it', () => {
    expect(circleClearance(PARAMECIUM, 1, resting(0))).toBeLessThan(GAP_WU * HALF_GAP);
    expect(circleClearance(PARAMECIUM, 2, resting(0))).toBeLessThan(GAP_WU * TOUCHING_SHARE);
    expect(circleClearance(PARAMECIUM, 3, resting(0))).toBeLessThan(GAP_WU * TOUCHING_SHARE);
  });
});

describe('the ring scales out round a fast swimmer’s stretched front', () => {
  it.each([0, 0.7, 1.4])('a round blob swimming flat out at %s s keeps a round cell’s rest gap', (time) => {
    expect(tracedClearance(null, 1, swimming(time))).toBeGreaterThanOrEqual(roundRestGap * CLEARANCE_SHARE);
  });

  it('is needed: the plain circle leaves a fast blob’s nose under half the gap (the pinch seen on main)', () => {
    expect(circleClearance(null, 1, swimming(0))).toBeLessThan(GAP_WU * HALF_GAP);
  });

  it('stays the plain circle, exactly, for a round blob at rest', () => {
    const terms = formTerms(null, 1, resting(0.7));
    expect(ringBodyPeak(terms)).toBe(1);
    expect(tracedRingOf(terms, RING_WU).lobes).toEqual([]);
  });
});
