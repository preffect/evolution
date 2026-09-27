// @vitest-environment node
// The arm hold (#753, docs/ecology/absorption.md §6.1 "the arm grab", docs/visual-style/motion-and-legibility.md §5.1):
// while the prey is held outside the body, the lobe nearest it reaches to it and draws back with it as the pull brings
// it in, then hands back to its flank and its cycle before the body takes the prey, with no snap.

import { describe, expect, it } from 'vitest';
import { AMOEBA_ARM_GRAB_REACH_RADII } from '@evolution/shared';
import { PSEUDOPOD_COUNT_BY_TIER, PSEUDOPOD_ENGULF_LEAN, PSEUDOPOD_HOLD_BLEND_RADII } from '../../constants';
import { gaussianBump, wrapAngle } from '../../geometry';
import type { ShapeBump } from '../radial-profile';
import { pseudopodBumps, type PseudopodInput } from './amoeba-pseudopods';

const PREY_ANGLE = -1.1;
const ENGULFING: PseudopodInput = {
  count: 4,
  timeSeconds: 1.7,
  phase: 0.3,
  aim: PREY_ANGLE,
  lean: PSEUDOPOD_ENGULF_LEAN,
  armHold: 0,
};
const HOLDS = [AMOEBA_ARM_GRAB_REACH_RADII, 0.4, PSEUDOPOD_HOLD_BLEND_RADII];

function surfaceAt(bumps: readonly ShapeBump[], theta: number): number {
  return bumps.reduce(
    (sum, bump) => sum + gaussianBump(bump.amplitude, wrapAngle(theta - bump.centre), bump.sigma).value,
    0,
  );
}

/** The lobes that differ from the fan without a hold. */
function movedLobes(input: PseudopodInput): ShapeBump[] {
  const fan = pseudopodBumps({ ...input, armHold: 0 });
  return pseudopodBumps(input).filter((lobe, index) => lobe.amplitude !== fan[index]?.amplitude);
}

describe('the arm hold (#753)', () => {
  it('moves exactly one lobe onto the prey, as long as the hold, at every tier', () => {
    for (const count of PSEUDOPOD_COUNT_BY_TIER) {
      for (const armHold of HOLDS) {
        const moved = movedLobes({ ...ENGULFING, count, armHold });
        expect(moved, `${count} lobes holding ${armHold}`).toHaveLength(1);
        expect(wrapAngle((moved[0]?.centre ?? 0) - PREY_ANGLE)).toBeCloseTo(0, 9);
        expect(moved[0]?.amplitude).toBeCloseTo(armHold, 9);
      }
    }
  });

  /** A lobe at the prey angle is not enough: the surface there must actually reach out to the prey. */
  it('reaches the surface out to the prey, and without the hold it does not', () => {
    for (const count of PSEUDOPOD_COUNT_BY_TIER) {
      const armHold = AMOEBA_ARM_GRAB_REACH_RADII;
      expect(surfaceAt(pseudopodBumps({ ...ENGULFING, count, armHold }), PREY_ANGLE)).toBeGreaterThanOrEqual(armHold);
      expect(surfaceAt(pseudopodBumps({ ...ENGULFING, count }), PREY_ANGLE)).toBeLessThan(armHold / 2);
    }
  });

  it('holds the prey still: the arm does not cycle while it holds', () => {
    const holdAt = (timeSeconds: number) =>
      movedLobes({ ...ENGULFING, timeSeconds, armHold: AMOEBA_ARM_GRAB_REACH_RADII })[0]?.amplitude;
    expect(holdAt(0.4)).toBe(holdAt(2.9));
  });

  it('reaches from the lobe nearest the prey, and the others keep their flanks', () => {
    const fan = pseudopodBumps(ENGULFING);
    const held = pseudopodBumps({ ...ENGULFING, armHold: 0.4 });
    const nearest = fan.reduce(
      (best, lobe, index) =>
        Math.abs(wrapAngle(lobe.centre - PREY_ANGLE)) < Math.abs(wrapAngle((fan[best]?.centre ?? 0) - PREY_ANGLE))
          ? index
          : best,
      0,
    );
    held.forEach((lobe, index) => {
      if (index === nearest) expect(lobe.centre).not.toBeCloseTo(fan[index]?.centre ?? 0, 3);
      else expect(lobe).toEqual(fan[index]);
    });
  });

  it('reaches no further than the server holds from, whatever the frame says', () => {
    const moved = movedLobes({ ...ENGULFING, armHold: 2 });
    expect(moved[0]?.amplitude).toBeCloseTo(AMOEBA_ARM_GRAB_REACH_RADII, 12);
  });

  /** The pull draws the prey in a little every frame: no step in it may jump the arm. */
  it('hands back to the fan with no snap as the body takes the prey', () => {
    expect(pseudopodBumps({ ...ENGULFING, armHold: 0 })).toEqual(pseudopodBumps(ENGULFING));
    const steps = 200;
    const step = AMOEBA_ARM_GRAB_REACH_RADII / steps;
    let previous = pseudopodBumps({ ...ENGULFING, armHold: 0 });
    for (let index = 1; index <= steps; index += 1) {
      const lobes = pseudopodBumps({ ...ENGULFING, armHold: index * step });
      lobes.forEach((lobe, lobeIndex) => {
        const before = previous[lobeIndex];
        expect(Math.abs(lobe.amplitude - (before?.amplitude ?? 0))).toBeLessThan(0.05);
        expect(Math.abs(wrapAngle(lobe.centre - (before?.centre ?? 0)))).toBeLessThan(0.1);
      });
      previous = lobes;
    }
  });
});
