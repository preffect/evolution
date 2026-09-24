// @vitest-environment node
// The amoeba (#192, docs/rendering/cells.md §2.1 / §2.4): 2 / 3 / 4 short, fat lobes in an irregular fan about the
// heading that move to the flanks with speed and round the prey while engulfing, each reaching and retracting out of
// step with its neighbours; unit area with the lobes; and a reach table no frame beats.

import { describe, expect, it } from 'vitest';
import {
  PSEUDOPOD_COUNT_BY_TIER,
  PSEUDOPOD_CYCLE_HZ,
  PSEUDOPOD_FLANK_DEG,
  PSEUDOPOD_PEAK_ANGLE_SAMPLES,
  PSEUDOPOD_REACH,
  PSEUDOPOD_RETRACTED_SHARE,
} from '../../constants';
import { degreesToRadians, gaussianBump, wrapAngle } from '../../geometry';
import type { ShapeBump } from '../radial-profile';
import {
  AMOEBA_CORE_PROFILE,
  pseudopodBumps,
  pseudopodReachTable,
  pseudopodSigma,
  pseudopodTableAngle,
  type PseudopodInput,
} from './amoeba-pseudopods';
import { PROFILE_WALK_TIMEOUT_MS } from '../../../../../testing/profile-walk';
import { normalisedArea } from './form-profiles';

const REST: PseudopodInput = { count: 4, timeSeconds: 0, phase: 0, aim: 0, lean: 0 };
const CYCLE_SECONDS = 1 / PSEUDOPOD_CYCLE_HZ;

/** Each lobe's offset from `from`, wrapped. */
function offsets(bumps: readonly ShapeBump[], from = 0): number[] {
  return bumps.map((bump) => wrapAngle(bump.centre - from));
}

function surfaceAt(bumps: readonly ShapeBump[], theta: number): number {
  return bumps.reduce(
    (sum, bump) => sum + gaussianBump(bump.amplitude, wrapAngle(theta - bump.centre), bump.sigma).value,
    0,
  );
}

/** The mean area over one extension cycle at `lean`. */
function cycleArea(count: number, lean: number): number {
  const steps = 48;
  let area = 0;
  for (let step = 0; step < steps; step += 1) {
    const bumps = pseudopodBumps({ ...REST, count, lean, timeSeconds: (step / steps) * CYCLE_SECONDS });
    area += normalisedArea(AMOEBA_CORE_PROFILE, bumps) / steps;
  }
  return area;
}

describe('pseudopodBumps', () => {
  it('grows one lobe per pseudopod at every tier, and none without the form', () => {
    for (const count of PSEUDOPOD_COUNT_BY_TIER) expect(pseudopodBumps({ ...REST, count })).toHaveLength(count);
    expect(pseudopodBumps({ ...REST, count: 0 })).toHaveLength(0);
  });

  /** M1 on PR #640: a fan that tiles the ring evenly reads as a rounded square at tier III. */
  it('rests in an irregular fan: no two lobes mirror each other across the aim, at any tier', () => {
    for (const count of PSEUDOPOD_COUNT_BY_TIER) {
      const around = offsets(pseudopodBumps({ ...REST, count }));
      for (const offset of around) {
        expect(
          around.some((other) => Math.abs(other + offset) < 1e-6),
          `${count} lobes`,
        ).toBe(false);
      }
    }
  });

  it('moves every lobe out of the stretched front to the flanks at speed', () => {
    const flank = degreesToRadians(PSEUDOPOD_FLANK_DEG);
    for (const count of PSEUDOPOD_COUNT_BY_TIER) {
      const swimming = offsets(pseudopodBumps({ ...REST, count, lean: 1 }));
      for (const offset of swimming) expect(Math.abs(offset), `${count} lobes`).toBeGreaterThanOrEqual(flank - 1e-9);
      const resting = offsets(pseudopodBumps({ ...REST, count }));
      expect(Math.min(...resting.map(Math.abs))).toBeLessThan(flank);
    }
  });

  /** The two aims the shape terms hand it: the heading, and the prey while engulfing. Both must be followed. */
  it('turns the whole fan with its aim', () => {
    for (const aim of [1, -2.5]) {
      for (const lean of [0, 1]) {
        const aimed = offsets(pseudopodBumps({ ...REST, aim, lean }), aim);
        expect(aimed).toEqual(offsets(pseudopodBumps({ ...REST, lean })).map((offset) => expect.closeTo(offset, 9)));
      }
    }
  });

  it('sways the resting fan and holds the swimming one still', () => {
    const later = { timeSeconds: 2 };
    expect(offsets(pseudopodBumps({ ...REST, ...later }))[0]).not.toBeCloseTo(offsets(pseudopodBumps(REST))[0] ?? 0, 2);
    expect(offsets(pseudopodBumps({ ...REST, ...later, lean: 1 }))[0]).toBeCloseTo(
      offsets(pseudopodBumps({ ...REST, lean: 1 }))[0] ?? 0,
      9,
    );
  });

  it('extends and retracts each lobe between the retracted share and its full reach, out of step with the next', () => {
    const steps = 240;
    const amplitudes = Array.from({ length: steps }, (_unused, step) =>
      pseudopodBumps({ ...REST, timeSeconds: (step / steps) * CYCLE_SECONDS }).map((bump) => bump.amplitude),
    );
    const first = amplitudes.map((lobes) => lobes[0] ?? 0);
    const second = amplitudes.map((lobes) => lobes[1] ?? 0);
    expect(Math.max(...first)).toBeCloseTo(PSEUDOPOD_REACH, 3);
    expect(Math.min(...first)).toBeCloseTo(PSEUDOPOD_REACH * PSEUDOPOD_RETRACTED_SHARE, 3);
    expect(first.indexOf(Math.max(...first))).not.toBe(second.indexOf(Math.max(...second)));
  });
});

describe('the amoeba silhouette', () => {
  it('trades width for count up the tiers: two fat lobes, four slim ones', () => {
    const sigmas = PSEUDOPOD_COUNT_BY_TIER.map(pseudopodSigma);
    expect(sigmas[1]).toBeLessThan(sigmas[0] ?? 0);
    expect(sigmas[2]).toBeLessThan(sigmas[1] ?? 0);
  });

  /** §2.4's size rule, with the lobes: mass ∝ area holds for the amoeba as for the blob, averaged over a cycle. */
  it('keeps unit area with its lobes at rest at every tier, within 0.5 %', () => {
    for (const count of PSEUDOPOD_COUNT_BY_TIER) {
      expect(Math.abs(cycleArea(count, 0) - 1), `${count} lobes`).toBeLessThan(0.005);
    }
  });

  /**
   * L1 on PR #640: moving to the flanks packs neighbouring lobes closer, and their overlap adds area. Swimming, the
   * speed stretch already reshapes every cell's outline, so the amoeba is held to 1 % there (§2.4 states it).
   */
  it('stays within 1 % of unit area at every speed', () => {
    for (const count of PSEUDOPOD_COUNT_BY_TIER) {
      for (const lean of [0.25, 0.5, 1]) {
        expect(Math.abs(cycleArea(count, lean) - 1), `${count} lobes at lean ${lean}`).toBeLessThan(0.01);
      }
    }
  });
});

describe('pseudopodReachTable', () => {
  /** The table the reach bounds weigh against the stretch: swept over time, phase and lean, never beaten. */
  it(
    'is never beaten by a frame of lobes, at any angle',
    () => {
      const beaten = (count: number, lean: number): string[] => {
        const table = pseudopodReachTable(count, lean);
        const misses: string[] = [];
        for (let step = 0; step < 16; step += 1) {
          const bumps = pseudopodBumps({ ...REST, count, lean, timeSeconds: step * 0.37, phase: step * 0.13 });
          for (let index = 0; index < PSEUDOPOD_PEAK_ANGLE_SAMPLES; index += 5) {
            if (surfaceAt(bumps, pseudopodTableAngle(index)) > (table[index] ?? 0))
              misses.push(`${count}@${lean}#${index}`);
          }
        }
        return misses;
      };
      for (const count of PSEUDOPOD_COUNT_BY_TIER) {
        for (const lean of [0, 0.2, 1]) expect(beaten(count, lean)).toEqual([]);
      }
    },
    PROFILE_WALK_TIMEOUT_MS,
  );

  /** It is also no looser than a frame gets: the preview frames its lens from it with a 1 % margin. */
  it(
    'is reached by some frame at its widest angle, within 0.5 %',
    () => {
      const table = pseudopodReachTable(3, 1);
      const widest = Math.max(...table);
      let reached = 0;
      for (let step = 0; step < 400; step += 1) {
        const bumps = pseudopodBumps({ ...REST, count: 3, lean: 1, timeSeconds: (step / 400) * CYCLE_SECONDS });
        for (let index = 0; index < PSEUDOPOD_PEAK_ANGLE_SAMPLES; index += 1) {
          reached = Math.max(reached, surfaceAt(bumps, pseudopodTableAngle(index)));
        }
      }
      expect(reached / widest).toBeGreaterThan(0.995);
    },
    PROFILE_WALK_TIMEOUT_MS,
  );

  it('is empty without lobes', () => {
    expect(Math.max(...pseudopodReachTable(0, 1))).toBe(0);
  });
});
