// @vitest-environment node
// The amoeba (#192, docs/rendering/cells.md §2.1 / §2.4): 2 / 3 / 4 lobes fanned about the heading that gather toward
// it with speed and toward the prey while engulfing, each reaching and retracting out of step with its neighbours;
// unit area with the lobes at every tier; and a peak reach no frame beats.

import { describe, expect, it } from 'vitest';
import {
  AMOEBA_CORE_SCALE,
  PSEUDOPOD_COUNT_BY_TIER,
  PSEUDOPOD_CYCLE_HZ,
  PSEUDOPOD_RETRACTED_SHARE,
} from '../../constants';
import { gaussianBump, wrapAngle } from '../../geometry';
import type { ShapeBump } from '../radial-profile';
import {
  AMOEBA_CORE_PROFILE,
  pseudopodBumps,
  pseudopodPeakRadii,
  pseudopodReach,
  type PseudopodInput,
} from './amoeba-pseudopods';
import { normalisedArea } from './form-profiles';

const REST: PseudopodInput = { count: 4, timeSeconds: 0, phase: 0, aim: 0, lean: 0 };
const CYCLE_SECONDS = 1 / PSEUDOPOD_CYCLE_HZ;

/** Each lobe's offset from `from`, wrapped: a fan of four at rest spans the whole ring, so a vector mean would vanish. */
function offsets(bumps: readonly ShapeBump[], from: number): number[] {
  return bumps.map((bump) => wrapAngle(bump.centre - from));
}

/** The angle between the fan's outermost lobes. */
function fanWidth(bumps: readonly ShapeBump[], aim = 0): number {
  const around = offsets(bumps, aim);
  return Math.max(...around) - Math.min(...around);
}

/** The fan's middle: the aim plus the mean offset of its lobes from it. */
function fanDirection(bumps: readonly ShapeBump[], aim = 0): number {
  const around = offsets(bumps, aim);
  return wrapAngle(aim + around.reduce((sum, offset) => sum + offset, 0) / around.length);
}

function surfaceAt(bumps: readonly ShapeBump[], theta: number): number {
  return bumps.reduce(
    (sum, bump) => sum + gaussianBump(bump.amplitude, wrapAngle(theta - bump.centre), bump.sigma).value,
    0,
  );
}

/** The widest `Σ bumps(θ)` over `samples` angles round the ring. */
function widestOnRing(bumps: readonly ShapeBump[], samples: number): number {
  let widest = 0;
  for (let angle = 0; angle < samples; angle += 1)
    widest = Math.max(widest, surfaceAt(bumps, (angle / samples) * 2 * Math.PI));
  return widest;
}

describe('pseudopodBumps', () => {
  it('grows one lobe per pseudopod at every tier, and none without the form', () => {
    for (const count of PSEUDOPOD_COUNT_BY_TIER) expect(pseudopodBumps({ ...REST, count })).toHaveLength(count);
    expect(pseudopodBumps({ ...REST, count: 0 })).toHaveLength(0);
  });

  it('fans the lobes about the aim, and gathers the fan as the cell speeds up', () => {
    const resting = pseudopodBumps(REST);
    const swimming = pseudopodBumps({ ...REST, lean: 1 });
    expect(fanDirection(resting)).toBeCloseTo(0, 6);
    expect(fanDirection(swimming)).toBeCloseTo(0, 6);
    expect(fanWidth(swimming)).toBeLessThan(fanWidth(resting) * 0.6);
  });

  /** The two aims the shape terms hand it: the heading, and the prey while engulfing. Both must be followed. */
  it('points the fan wherever it is aimed', () => {
    for (const aim of [1, -2.5]) {
      expect(fanDirection(pseudopodBumps({ ...REST, aim, lean: 1 }), aim)).toBeCloseTo(aim, 6);
      expect(fanDirection(pseudopodBumps({ ...REST, aim }), aim)).toBeCloseTo(aim, 6);
      expect(fanDirection(pseudopodBumps({ ...REST, aim: 0, lean: 1 }), aim)).not.toBeCloseTo(aim, 2);
    }
  });

  it('sways the resting fan and holds the swimming one still', () => {
    const quarterSway = { timeSeconds: 2 };
    expect(fanDirection(pseudopodBumps({ ...REST, ...quarterSway }))).not.toBeCloseTo(0, 2);
    expect(fanDirection(pseudopodBumps({ ...REST, ...quarterSway, lean: 1 }))).toBeCloseTo(0, 6);
  });

  it('extends and retracts each lobe between the retracted share and its full reach, out of step with the next', () => {
    const reach = pseudopodReach(REST.count);
    const steps = 240;
    const amplitudes = Array.from({ length: steps }, (_unused, step) =>
      pseudopodBumps({ ...REST, timeSeconds: (step / steps) * CYCLE_SECONDS }).map((bump) => bump.amplitude),
    );
    const first = amplitudes.map((lobes) => lobes[0] ?? 0);
    const second = amplitudes.map((lobes) => lobes[1] ?? 0);
    expect(Math.max(...first)).toBeCloseTo(reach, 3);
    expect(Math.min(...first)).toBeCloseTo(reach * PSEUDOPOD_RETRACTED_SHARE, 3);
    expect(first.indexOf(Math.max(...first))).not.toBe(second.indexOf(Math.max(...second)));
  });

  it('moves with the clock: a lobe a quarter-cycle on is not where it was', () => {
    const now = pseudopodBumps(REST)[0]?.amplitude;
    const later = pseudopodBumps({ ...REST, timeSeconds: CYCLE_SECONDS / 4 })[0]?.amplitude;
    expect(later).not.toBeCloseTo(now ?? 0, 3);
  });
});

describe('the amoeba silhouette', () => {
  it('reaches about 1.6 r at tier I (sheet 04) and trades length for count up the tiers', () => {
    const reaches = PSEUDOPOD_COUNT_BY_TIER.map((count) => AMOEBA_CORE_SCALE * (1 + pseudopodReach(count)));
    expect(reaches[0]).toBeGreaterThan(1.55);
    expect(reaches[0]).toBeLessThan(1.65);
    expect(reaches[1]).toBeLessThan(reaches[0] ?? 0);
    expect(reaches[2]).toBeLessThan(reaches[1] ?? 0);
    expect(reaches[2]).toBeGreaterThan(1.2);
  });

  /** §2.4's size rule, with the lobes: mass ∝ area holds for the amoeba as for the blob, averaged over a cycle. */
  it('keeps unit area with its lobes at every tier, within 0.5 %', () => {
    const steps = 48;
    for (const count of PSEUDOPOD_COUNT_BY_TIER) {
      let area = 0;
      for (let step = 0; step < steps; step += 1) {
        const bumps = pseudopodBumps({ ...REST, count, timeSeconds: (step / steps) * CYCLE_SECONDS });
        area += normalisedArea(AMOEBA_CORE_PROFILE, bumps) / steps;
      }
      expect(Math.abs(area - 1), `${count} lobes`).toBeLessThan(0.005);
    }
  });
});

describe('pseudopodPeakRadii', () => {
  /** The bound the preview lens and the cull frame by: swept over time, phase, aim and lean, never beaten. */
  it('is never beaten by a frame of lobes', () => {
    for (const count of PSEUDOPOD_COUNT_BY_TIER) {
      for (const lean of [0, 0.5, 1]) {
        const bound = pseudopodPeakRadii(count, lean);
        let reached = 0;
        for (let step = 0; step < 40; step += 1) {
          const bumps = pseudopodBumps({ count, lean, timeSeconds: step * 0.37, phase: step * 0.13, aim: step });
          reached = Math.max(reached, widestOnRing(bumps, 720));
        }
        expect(reached, `${count} lobes at lean ${lean}`).toBeLessThanOrEqual(bound);
      }
    }
  });

  /** It is also no looser than a frame gets: the preview frames its lens from it with a 1 % margin. */
  it('is reached by some frame, within 0.5 %', () => {
    const count = 3;
    const bound = pseudopodPeakRadii(count, 1);
    let reached = 0;
    for (let step = 0; step < 400; step += 1) {
      const bumps = pseudopodBumps({ ...REST, count, lean: 1, timeSeconds: (step / 400) * CYCLE_SECONDS });
      reached = Math.max(reached, widestOnRing(bumps, 1440));
    }
    expect(reached / bound).toBeGreaterThan(0.995);
  });

  it('grows as the fan gathers, since gathered lobes overlap', () => {
    expect(pseudopodPeakRadii(4, 1)).toBeGreaterThan(pseudopodPeakRadii(4, 0));
    expect(pseudopodPeakRadii(0, 1)).toBe(0);
  });
});
