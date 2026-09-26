// The form terms the reach bounds must see (#192; docs/rendering/cells.md §2.4): every form's drawn membrane against
// the body bound, the amoeba's lobes counted in it, and the amoeba's arm tips clear of the 1.3 r rings at every speed (#646).

import { TICK_INTERVAL_S, type CellView, type TraitTier } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import {
  PROFILE_WALK_TICKS,
  PROFILE_WALK_TICK_STRIDE,
  PROFILE_WALK_TIMEOUT_MS,
  drawnMembraneAt,
  profileWalkTerms,
  profileWalkView,
} from '../../../../testing/profile-walk';
import { ENGULF_WARNING_RING_RADII, RELATION_RING_RADII } from '../constants';
import { cellDrawExtentRadii, restingDrawState } from './cell-draw-extent';
import { summariseCellTraits } from './cell-traits';
import { FORM_PROFILES, formFor, pseudopodCount } from './forms/form-profiles';
import { evaluateProfile } from './radial-profile';

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
