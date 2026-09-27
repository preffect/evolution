// @vitest-environment node
// The form-normalised body frame (#194 review): no form at rest draws a membrane on the body ramp's flat last stop,
// the spindle's tips included, and the blob's frame is exactly the undeformed one.

import { TICK_INTERVAL_S } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import {
  PROFILE_WALK_RING_SAMPLES,
  PROFILE_WALK_TICKS,
  PROFILE_WALK_TICK_STRIDE,
  PROFILE_WALK_TIMEOUT_MS,
  profileWalkTerms,
  profileWalkView,
} from '../../../../testing/profile-walk';
import { BODY_RAMP_STOPS } from '../constants';
import { bodyFramePoint, bodyRampShare } from './body-frame';
import { FORM_PROFILES } from './forms/form-profiles';
import { evaluateProfile, type RadialProfileTerms } from './radial-profile';

const [, , , LAST_STOP] = BODY_RAMP_STOPS;
const RESTING = 0;

/**
 * The largest ramp `t` on the drawn body round the ring: the membrane without its bumps, since an amoeba's arm is meant
 * to reach past the ramp and show the rim (cells.md §2.2).
 */
function widestRampShare(withBumps: RadialProfileTerms): number {
  const terms = { ...withBumps, bumps: [] };
  let widest = 0;
  for (let index = 0; index < PROFILE_WALK_RING_SAMPLES; index += 1) {
    const theta = (index / PROFILE_WALK_RING_SAMPLES) * 2 * Math.PI;
    const membrane = evaluateProfile(terms, theta).r;
    widest = Math.max(
      widest,
      bodyRampShare(bodyFramePoint(terms, membrane * Math.cos(theta), membrane * Math.sin(theta))),
    );
  }
  return widest;
}

describe('the body frame', () => {
  it('is the undeformed frame for the blob', () => {
    const terms = profileWalkTerms(profileWalkView([], RESTING, false), 0, RESTING);
    expect(bodyFramePoint(terms, 0.4, -0.7)).toEqual({ x: 0.4, y: -0.7 });
  });

  /** The spindle's tips at 1.85 r were a flat pale cap past the last stop in the undeformed frame (PR #765 review). */
  it(
    'keeps every form’s membrane at rest short of the ramp’s last stop',
    () => {
      const misses: string[] = [];
      for (const traitId of FORM_PROFILES.keys()) {
        const view = profileWalkView([{ traitId, tier: 3 }], RESTING, false);
        for (let tick = 0; tick <= PROFILE_WALK_TICKS; tick += PROFILE_WALK_TICK_STRIDE * 4) {
          const share = widestRampShare(profileWalkTerms(view, tick * TICK_INTERVAL_S, RESTING));
          if (share >= LAST_STOP) misses.push(`${traitId} at tick ${tick}: ${share.toFixed(3)}`);
        }
      }
      expect(misses).toEqual([]);
    },
    PROFILE_WALK_TIMEOUT_MS,
  );
});
