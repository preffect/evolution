// The amoeba's arm lengths (shared/constants/pseudopods.ts, #735): the grab reach the server reads is the drawn arm's
// shortest length past the body, so the arm the player sees and the arm that grabs never drift apart.

import { describe, expect, it } from 'vitest';
import { AMOEBA_ARM_GRAB_REACH_RADII, PSEUDOPOD_REACH, PSEUDOPOD_RETRACTED_SHARE } from './pseudopods.js';
import { AMOEBA_PSEUDOPODS_TIERS } from './trait-modifiers.js';

const REACH_DIGITS = 12;

describe('the arm grab reach (#735)', () => {
  it("is the arm's reach at its most retracted", () => {
    expect(AMOEBA_ARM_GRAB_REACH_RADII).toBeCloseTo(PSEUDOPOD_REACH * PSEUDOPOD_RETRACTED_SHARE, REACH_DIGITS);
  });

  it('is what every Amoeba Pseudopods tier grabs with: the tier adds arms, not length', () => {
    expect(AMOEBA_PSEUDOPODS_TIERS.map((tier) => tier.armGrabReachRadii)).toEqual(
      AMOEBA_PSEUDOPODS_TIERS.map(() => AMOEBA_ARM_GRAB_REACH_RADII),
    );
  });
});
