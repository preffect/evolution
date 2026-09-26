// @vitest-environment node
// The amoeba (#192, #646, docs/rendering/cells.md §2.1 / §2.4): 2 / 3 / 4 long arms in an irregular fan about the
// heading that move to the flanks with speed and round the prey while engulfing, each reaching and retracting out of
// step with its neighbours; well past the rings (visual-style/motion-and-legibility.md §5.1); and a reach table no
// frame beats.

import { describe, expect, it } from 'vitest';
import {
  AMOEBA_CORE_SCALE,
  APPENDAGE_MIN_NECK_WIDTH_RADII,
  APPENDAGE_MIN_REACH_PAST_RING_RADII,
  APPENDAGE_MIN_RETRACTED_PAST_RING_RADII,
  BREATH_AMPLITUDE,
  ENGULF_WARNING_RING_RADII,
  PSEUDOPOD_COUNT_BY_TIER,
  PSEUDOPOD_CYCLE_HZ,
  PSEUDOPOD_FLANK_DEG,
  PSEUDOPOD_PEAK_ANGLE_SAMPLES,
  PSEUDOPOD_REACH,
  PSEUDOPOD_RETRACTED_SHARE,
} from '../../constants';
import { HALF, degreesToRadians, gaussianBump, wrapAngle } from '../../geometry';
import type { ShapeBump } from '../radial-profile';
import {
  pseudopodBumps,
  pseudopodReachTable,
  pseudopodSigma,
  pseudopodTableAngle,
  type PseudopodInput,
} from './amoeba-pseudopods';
import { PROFILE_WALK_TIMEOUT_MS } from '../../../../../testing/profile-walk';

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

  /**
   * §5.1's appendage rule (#646): at rest, on the breath's inhale, every lobe's tip clears the 1.3 r rings by the
   * rule's margin at full reach and still clears them at its shortest, so the player sees the arms at normal zoom.
   */
  it('reaches well past the rings at full extension and never retracts inside them, at every tier', () => {
    const tipAt = (amplitude: number): number => AMOEBA_CORE_SCALE * (1 - BREATH_AMPLITUDE + amplitude);
    const steps = 96;
    for (const count of PSEUDOPOD_COUNT_BY_TIER) {
      const amplitudes = Array.from({ length: steps }, (_unused, step) =>
        pseudopodBumps({ ...REST, count, timeSeconds: (step / steps) * CYCLE_SECONDS }).map((bump) => bump.amplitude),
      ).flat();
      const past = (amplitude: number): number => tipAt(amplitude) - ENGULF_WARNING_RING_RADII;
      expect(past(Math.max(...amplitudes)), `${count} lobes`).toBeGreaterThanOrEqual(
        APPENDAGE_MIN_REACH_PAST_RING_RADII,
      );
      expect(past(Math.min(...amplitudes)), `${count} lobes`).toBeGreaterThanOrEqual(
        APPENDAGE_MIN_RETRACTED_PAST_RING_RADII,
      );
    }
  });

  /**
   * §5.1 rule 2, never a hairline: each lobe's width at its neck, halfway out along it, walked on the whole surface
   * (neighbours included) from the lobe's centre to where the surface drops below half the lobe's height.
   */
  it('keeps every arm at least the rule’s neck width, at rest and swimming, over a whole cycle', () => {
    const angleStep = degreesToRadians(0.1);
    const narrowest = (count: number, lean: number): number => {
      let width = Infinity;
      for (let step = 0; step < 48; step += 1) {
        const bumps = pseudopodBumps({ ...REST, count, lean, timeSeconds: (step / 48) * CYCLE_SECONDS });
        for (const lobe of bumps) {
          const neck = lobe.amplitude * HALF;
          let halfSpan = 0;
          while (surfaceAt(bumps, lobe.centre + halfSpan + angleStep) >= neck) halfSpan += angleStep;
          const neckRadius = AMOEBA_CORE_SCALE * (1 + neck);
          width = Math.min(width, 2 * neckRadius * Math.sin(halfSpan));
        }
      }
      return width;
    };
    for (const count of PSEUDOPOD_COUNT_BY_TIER) {
      for (const lean of [0, 1]) {
        expect(narrowest(count, lean), `${count} lobes at lean ${lean}`).toBeGreaterThanOrEqual(
          APPENDAGE_MIN_NECK_WIDTH_RADII,
        );
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
