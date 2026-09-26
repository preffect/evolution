// The form terms the reach bounds must see (#192; docs/rendering/cells.md §2.4): every form's drawn membrane against
// the body bound, the amoeba's lobes counted in it, and the amoeba's arm tips clear of the 1.3 r rings at every speed
// (#646); the paramecium's cilia tufts clear of them at every speed too, and inside the quad and the lens (#193).

import { TICK_INTERVAL_S, type CellView, type TraitTier } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import {
  PROFILE_WALK_RING_SAMPLES,
  PROFILE_WALK_TICKS,
  PROFILE_WALK_TICK_STRIDE,
  PROFILE_WALK_TIMEOUT_MS,
  drawnMembraneAt,
  profileWalkTerms,
  profileWalkView,
} from '../../../../testing/profile-walk';
import {
  CILIA_TUFT_REACH_RADII,
  CILIA_TUFT_TIP_WIDTH_RADII,
  ENGULF_WARNING_RING_RADII,
  RELATION_RING_RADII,
  SLIPPER_ASPECT_BY_TIER,
} from '../constants';
import { cellDrawExtentRadii, restingDrawState } from './cell-draw-extent';
import { summariseCellTraits } from './cell-traits';
import { FORM_PROFILES, formFor, pseudopodCount } from './forms/form-profiles';
import { ciliaTufts, tuftCentreTurn, type CiliaTuft } from './forms/paramecium-cilia';
import { evaluateProfile, sampleProfileRing, type RadialProfileTerms } from './radial-profile';

const TIER_I: TraitTier = 1;
const TIER_II: TraitTier = 2;
const TIER_III: TraitTier = 3;
const RESTING = 0;
const SWIMMING = 1;
const viewOf = profileWalkView;

/**
 * The form terms the bounds must see (#192 turned the old tripwire into this): a form's `B` and the amoeba's lobes,
 * measured on the drawn membrane itself over swept time, so one the bounds leave out shows up as a clipped cell.
 */
describe('the form profiles the bounds must see', () => {
  /** The widest membrane drawn over the swept ticks. */
  function widestDrawnRadii(view: CellView, speedRatio: number): number {
    let widest = 0;
    for (let tick = 0; tick <= PROFILE_WALK_TICKS; tick += PROFILE_WALK_TICK_STRIDE) {
      const drawn = drawnMembraneAt(view, tick * TICK_INTERVAL_S, speedRatio);
      expect(drawn.widest, 'the per-instance reach covers the drawn membrane').toBeLessThanOrEqual(drawn.quadMembrane);
      widest = Math.max(widest, drawn.widest);
    }
    return widest;
  }

  it(
    'never draws a membrane past the body bound, for any form at any tier',
    () => {
      const cases = [...FORM_PROFILES.keys()].flatMap((traitId) =>
        [TIER_I, TIER_II, TIER_III].flatMap((tier) =>
          [RESTING, SWIMMING].map((speedRatio) => ({ traitId, tier, speedRatio })),
        ),
      );
      for (const { traitId, tier, speedRatio } of cases) {
        const view = viewOf([{ traitId, tier }], speedRatio, false);
        const { bodyRadii } = cellDrawExtentRadii(summariseCellTraits(view), restingDrawState(speedRatio));
        expect(widestDrawnRadii(view, speedRatio), `${traitId} ${tier} at speed ${speedRatio}`).toBeLessThanOrEqual(
          bodyRadii,
        );
      }
    },
    PROFILE_WALK_TIMEOUT_MS,
  );

  /** The lobes count in the bound: without them it would be the round core's, the blob's. */
  it('widens the amoeba’s body bound past the blob’s by its lobes', () => {
    const amoeba = viewOf([{ traitId: 'amoeba_pseudopods', tier: TIER_I }], RESTING, false);
    const blob = viewOf([], RESTING, false);
    const amoebaBody = cellDrawExtentRadii(summariseCellTraits(amoeba), restingDrawState(RESTING)).bodyRadii;
    const blobBody = cellDrawExtentRadii(summariseCellTraits(blob), restingDrawState(RESTING)).bodyRadii;
    expect(amoebaBody).toBeGreaterThan(blobBody);
  });

  /** The shortest arm tip drawn over the swept ticks: the membrane at each lobe's own centre angle. */
  function shortestTipRadii(tier: TraitTier, speedRatio: number): number {
    const view = viewOf([{ traitId: 'amoeba_pseudopods', tier }], speedRatio, false);
    const count = pseudopodCount(formFor('amoeba_pseudopods'), tier);
    let shortest = Infinity;
    for (let tick = 0; tick <= PROFILE_WALK_TICKS; tick += PROFILE_WALK_TICK_STRIDE) {
      const terms = profileWalkTerms(view, tick * TICK_INTERVAL_S, speedRatio);
      for (const lobe of terms.bumps.slice(0, count))
        shortest = Math.min(shortest, evaluateProfile(terms, lobe.centre).r);
    }
    return shortest;
  }

  /**
   * #646: an arm the player cannot see past the 1.3 r rings is an arm they never learn about (motion-and-legibility.md
   * §5.1 rule 1). Measured at each arm's own tip, so the speed stretch pushing the front past the ring cannot stand in
   * for an arm.
   */
  it(
    'keeps every arm tip past the warning and relation rings at every tier and speed',
    () => {
      const ring = Math.max(ENGULF_WARNING_RING_RADII, RELATION_RING_RADII);
      const tips = [TIER_I, TIER_II, TIER_III].flatMap((tier) =>
        [0, 0.125, 0.25, 0.3, 1 / 3, 0.375, 0.5, 0.75, 1].map((speedRatio) => ({
          label: `tier ${tier} at speed ${speedRatio}`,
          shortest: shortestTipRadii(tier, speedRatio),
        })),
      );
      expect(
        tips.filter((tip) => tip.shortest <= ring).map((tip) => `${tip.label}: ${tip.shortest.toFixed(4)}`),
      ).toEqual([]);
    },
    PROFILE_WALK_TIMEOUT_MS,
  );
});

/** The paramecium's tufts (#193): an appendage like the amoeba's arms, so held to the same two checks. */
const BEAT_SAMPLES = 12;
const TUFT_SPEEDS = [0, 0.25, 0.5, 0.75, 1];

describe('the paramecium’s cilia tufts the bounds and the rings must see', () => {
  const paramecium = (tier: TraitTier, speedRatio: number) =>
    viewOf([{ traitId: 'paramecium_cilia', tier }], speedRatio, false);

  /** Every tuft at every sampled beat over the walk's ticks, with the terms it hangs off. */
  function eachTuft(tier: TraitTier, speedRatio: number, visit: (terms: RadialProfileTerms, tuft: CiliaTuft) => void) {
    const view = paramecium(tier, speedRatio);
    const aspect = SLIPPER_ASPECT_BY_TIER[tier - 1] ?? 1;
    for (let tick = 0; tick <= PROFILE_WALK_TICKS; tick += PROFILE_WALK_TICK_STRIDE * 4) {
      const terms = profileWalkTerms(view, tick * TICK_INTERVAL_S, speedRatio);
      for (let beat = 0; beat < BEAT_SAMPLES; beat += 1) {
        for (const tuft of ciliaTufts(aspect, { ciliaPhase: beat / BEAT_SAMPLES, speedRatio })) visit(terms, tuft);
      }
    }
  }

  /** §5.1 rule 1 at speed: measured at each tuft's own tip, so the stretched nose cannot stand in for a flank tuft. */
  it(
    'keeps every tuft tip past the warning and relation rings at every tier and speed',
    () => {
      const ring = Math.max(ENGULF_WARNING_RING_RADII, RELATION_RING_RADII);
      const misses: string[] = [];
      for (const tier of [TIER_I, TIER_II, TIER_III]) {
        for (const speedRatio of TUFT_SPEEDS) {
          let shortest = Infinity;
          eachTuft(tier, speedRatio, (terms, tuft) => {
            const root = evaluateProfile(terms, tuft.delta).r;
            const tipAngle = tuft.delta + tuftCentreTurn(tuft, root, tuft.lengthRadii);
            shortest = Math.min(shortest, evaluateProfile(terms, tipAngle).r + tuft.lengthRadii);
          });
          if (shortest <= ring) misses.push(`tier ${tier} at speed ${speedRatio}: ${shortest.toFixed(4)}`);
        }
      }
      expect(misses).toEqual([]);
    },
    PROFILE_WALK_TIMEOUT_MS,
  );

  /** §5.1 rule 5: the quad and the preview lens reach the tufts' round tips on the widest membrane drawn. */
  it(
    'reaches every tuft tip with the quad and the drawn bound, at every tier and speed',
    () => {
      const tipReach = CILIA_TUFT_REACH_RADII + CILIA_TUFT_TIP_WIDTH_RADII / 2;
      for (const tier of [TIER_I, TIER_II, TIER_III]) {
        for (const speedRatio of [RESTING, SWIMMING]) {
          const view = paramecium(tier, speedRatio);
          const { drawnRadii } = cellDrawExtentRadii(summariseCellTraits(view), restingDrawState(speedRatio));
          for (let tick = 0; tick <= PROFILE_WALK_TICKS; tick += PROFILE_WALK_TICK_STRIDE) {
            const terms = profileWalkTerms(view, tick * TICK_INTERVAL_S, speedRatio);
            const drawn = Math.max(...sampleProfileRing(terms, PROFILE_WALK_RING_SAMPLES)) + tipReach;
            expect(drawn, `quad, tier ${tier} at speed ${speedRatio}`).toBeLessThanOrEqual(terms.maxRadii);
            expect(drawn, `lens, tier ${tier} at speed ${speedRatio}`).toBeLessThanOrEqual(drawnRadii);
          }
        }
      }
    },
    PROFILE_WALK_TIMEOUT_MS,
  );
});
