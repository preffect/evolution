// @vitest-environment node
// The euglena's eyespot (#194; visual-style/cells-and-organelles.md §4): toward the nose, off the axis, inside the
// spindle with its halo at every speed, and brighter each tier.

import { TICK_INTERVAL_S } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import {
  PROFILE_WALK_TICKS,
  PROFILE_WALK_TICK_STRIDE,
  PROFILE_WALK_TIMEOUT_MS,
  profileWalkTerms,
  profileWalkView,
} from '../../../../../testing/profile-walk';
import { EYESPOT_HALO_ALPHA } from '../../constants';
import { evaluateProfile, type RadialProfileTerms } from '../radial-profile';
import { eyespotHaloAlpha, eyespotPlacement } from './euglena-eyespot';

const HALO_SAMPLES = 24;

describe('the euglena’s eyespot', () => {
  it('sits toward the nose, off the axis', () => {
    const terms = profileWalkTerms(profileWalkView([{ traitId: 'euglena_eyespot', tier: 1 }], 0, false), 0, 0);
    const { centre } = eyespotPlacement(terms);
    expect(centre.along).toBeGreaterThan(0.5);
    expect(centre.across).not.toBe(0);
  });

  /** Whether any point of the halo's rim lies on or past the membrane in `terms`. */
  function haloCrossesMembrane(terms: RadialProfileTerms): boolean {
    const { centre, haloRadii } = eyespotPlacement(terms);
    return Array.from({ length: HALO_SAMPLES }, (_unused, index) => (index / HALO_SAMPLES) * 2 * Math.PI).some(
      (turn) => {
        const x = centre.along + haloRadii * Math.cos(turn);
        const y = centre.across + haloRadii * Math.sin(turn);
        return Math.hypot(x, y) >= evaluateProfile(terms, Math.atan2(y, x)).r;
      },
    );
  }

  it(
    'keeps the dot and its halo inside the spindle at every speed',
    () => {
      const misses: string[] = [];
      for (const speedRatio of [0, 0.5, 1]) {
        const view = profileWalkView([{ traitId: 'euglena_eyespot', tier: 1 }], speedRatio, false);
        for (let tick = 0; tick <= PROFILE_WALK_TICKS; tick += PROFILE_WALK_TICK_STRIDE * 4) {
          if (haloCrossesMembrane(profileWalkTerms(view, tick * TICK_INTERVAL_S, speedRatio)))
            misses.push(`speed ${speedRatio} at tick ${tick}`);
        }
      }
      expect(misses).toEqual([]);
    },
    PROFILE_WALK_TIMEOUT_MS,
  );

  it('brightens its halo by a quarter each tier', () => {
    expect([1, 2, 3].map(eyespotHaloAlpha)).toEqual([1, 1.25, 1.5].map((gain) => EYESPOT_HALO_ALPHA * gain));
  });
});
