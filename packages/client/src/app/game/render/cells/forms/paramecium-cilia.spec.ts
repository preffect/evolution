// @vitest-environment node
// The paramecium's cilia tufts (#193, #646; docs/visual-style/motion-and-legibility.md §5.1): a full fringe of bold
// tufts round the slipper, each reaching well past the 1.3 r rings at full extension and never retracting inside
// them, never a hairline at its neck, beating in a wave from the nose to the tail and bending back toward the tail.
// Measured on the membrane the renderer draws (`profile-walk.ts`), at every tier.

import { RADIANS_PER_FULL_TURN, TICK_INTERVAL_S, type TraitTier } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import {
  PROFILE_WALK_TICKS,
  PROFILE_WALK_TICK_STRIDE,
  PROFILE_WALK_TIMEOUT_MS,
  profileWalkTerms,
  profileWalkView,
} from '../../../../../testing/profile-walk';
import {
  APPENDAGE_MIN_NECK_WIDTH_RADII,
  APPENDAGE_MIN_REACH_PAST_RING_RADII,
  APPENDAGE_MIN_RETRACTED_PAST_RING_RADII,
  CILIA_TUFT_COUNT,
  CILIA_TUFT_REACH_RADII,
  CILIA_TUFT_TIP_WIDTH_RADII,
  CILIA_TUFT_WAVES_PER_FLANK,
  ENGULF_WARNING_RING_RADII,
  SLIPPER_ASPECT_BY_TIER,
} from '../../constants';
import { HALF, degreesToRadians } from '../../geometry';
import { evaluateProfile, type RadialProfileTerms } from '../radial-profile';
import { formFor } from './form-profiles';
import {
  ciliaTuftAt,
  ciliaTuftDrawnReachRadii,
  ciliaTufts,
  isInsideTuft,
  tuftArcWidening,
  tuftCentreTurn,
  tuftParameterOf,
  type CiliaTuft,
  type TuftMotion,
} from './paramecium-cilia';

const TIERS: readonly TraitTier[] = [1, 2, 3];
const RESTING: TuftMotion = { ciliaPhase: 0, speedRatio: 0 };
const PHASE_SAMPLES = 24;
const aspectOf = (tier: TraitTier): number => SLIPPER_ASPECT_BY_TIER[tier - 1] ?? 1;

/** The membrane under `delta` (heading frame; the walks head along 0), in radii. */
function membraneAt(terms: RadialProfileTerms, delta: number): number {
  return evaluateProfile(terms, delta).r;
}

/** How far out the tuft's tip is from the centre: the membrane under the tip plus the tuft's radial length. */
function tipRadii(terms: RadialProfileTerms, tuft: CiliaTuft): number {
  const tipAngle = tuft.delta + tuftCentreTurn(tuft, membraneAt(terms, tuft.delta), tuft.lengthRadii);
  return membraneAt(terms, tipAngle) + tuft.lengthRadii;
}

/** The walk's shape terms for a paramecium at `tier` and `speedRatio`, every stride-th tick. */
function walkTerms(tier: TraitTier, speedRatio: number): RadialProfileTerms[] {
  const view = profileWalkView([{ traitId: 'paramecium_cilia', tier }], speedRatio, false);
  const terms: RadialProfileTerms[] = [];
  for (let tick = 0; tick <= PROFILE_WALK_TICKS; tick += PROFILE_WALK_TICK_STRIDE * 4) {
    terms.push(profileWalkTerms(view, tick * TICK_INTERVAL_S, speedRatio));
  }
  return terms;
}

/** Every tuft at `PHASE_SAMPLES` points of one beat, at `speedRatio`, every `phaseStride`-th point. */
function tuftsOverABeat(tier: TraitTier, speedRatio: number, phaseStride = 1): CiliaTuft[] {
  const tufts: CiliaTuft[] = [];
  for (let step = 0; step < PHASE_SAMPLES; step += phaseStride) {
    tufts.push(...ciliaTufts(aspectOf(tier), { ciliaPhase: step / PHASE_SAMPLES, speedRatio }));
  }
  return tufts;
}

/** The cilia phase at which tuft `index` stands at full extension: its beat a quarter turn in. */
function fullExtensionPhase(index: number): number {
  return 1 / 4 + (CILIA_TUFT_WAVES_PER_FLANK * Math.abs(tuftParameterOf(index))) / Math.PI;
}

describe('the cilia tufts past the rings (§5.1 rule 1)', () => {
  it(
    'reach at least 0.6 r past the 1.3 r ring at full extension, every tuft at every tier, at rest',
    () => {
      const shortest = TIERS.map((tier) => {
        let tip = Infinity;
        for (const terms of walkTerms(tier, 0)) {
          for (let index = 0; index < CILIA_TUFT_COUNT; index += 1) {
            const tuft = ciliaTuftAt(index, aspectOf(tier), { ...RESTING, ciliaPhase: fullExtensionPhase(index) });
            expect(tuft.lengthRadii).toBeCloseTo(CILIA_TUFT_REACH_RADII, 9);
            tip = Math.min(tip, tipRadii(terms, tuft));
          }
        }
        return tip - ENGULF_WARNING_RING_RADII;
      });
      for (const past of shortest) expect(past).toBeGreaterThanOrEqual(APPENDAGE_MIN_REACH_PAST_RING_RADII);
    },
    PROFILE_WALK_TIMEOUT_MS,
  );

  it(
    'never retract to less than 0.15 r past the ring, over a whole beat at every tier',
    () => {
      for (const tier of TIERS) {
        let tip = Infinity;
        const tufts = tuftsOverABeat(tier, 0);
        for (const terms of walkTerms(tier, 0)) {
          for (const tuft of tufts) tip = Math.min(tip, tipRadii(terms, tuft));
        }
        expect(tip - ENGULF_WARNING_RING_RADII, `tier ${tier}`).toBeGreaterThanOrEqual(
          APPENDAGE_MIN_RETRACTED_PAST_RING_RADII,
        );
      }
    },
    PROFILE_WALK_TIMEOUT_MS,
  );
});

describe('the cilia tufts’ width (§5.1 rule 2)', () => {
  /**
   * Walked along the arc at the neck (halfway out, radially) from the tuft's centre line until it leaves the tuft, then
   * taken square across the bent tuft: a tuft swept back is narrower across than along the arc it crosses.
   */
  function neckWidth(terms: RadialProfileTerms, tuft: CiliaTuft): number {
    const neck = tuft.lengthRadii * HALF;
    const centre = tuft.delta + tuftCentreTurn(tuft, membraneAt(terms, tuft.delta), neck);
    const step = degreesToRadians(0.2);
    const pointAt = (delta: number) => {
      const membraneRadii = membraneAt(terms, delta);
      return { delta, radiusRadii: membraneRadii + neck, membraneRadii };
    };
    const inside = (delta: number): boolean => isInsideTuft(pointAt(delta), tuft);
    let width = 0;
    for (const direction of [-1, 1]) {
      for (let delta = centre; inside(delta + direction * step); delta += direction * step) {
        width += step * pointAt(delta).radiusRadii;
      }
    }
    return width / tuftArcWidening(tuft, neck);
  }

  it(
    'keeps every tuft at least the rule’s neck width, at rest and swimming, over a beat',
    () => {
      for (const tier of TIERS) {
        for (const speedRatio of [0, 1]) {
          const [terms] = walkTerms(tier, speedRatio) as [RadialProfileTerms];
          const widths = tuftsOverABeat(tier, speedRatio, 3).map((tuft) => neckWidth(terms, tuft));
          const narrowest = Math.min(...widths);
          expect(narrowest, `tier ${tier} at speed ${speedRatio}`).toBeGreaterThanOrEqual(
            APPENDAGE_MIN_NECK_WIDTH_RADII,
          );
        }
      }
    },
    PROFILE_WALK_TIMEOUT_MS,
  );

  it('ends in a round cap the tip’s width across, and is nothing inside the membrane', () => {
    const tuft: CiliaTuft = { delta: 0, lengthRadii: 1, lean: 0 };
    const cap = CILIA_TUFT_TIP_WIDTH_RADII * HALF;
    expect(isInsideTuft({ delta: 0, radiusRadii: 2 + cap * 0.99, membraneRadii: 1 }, tuft)).toBe(true);
    expect(isInsideTuft({ delta: 0, radiusRadii: 2 + cap * 1.01, membraneRadii: 1 }, tuft)).toBe(false);
    expect(isInsideTuft({ delta: 0, radiusRadii: 0.9, membraneRadii: 1 }, tuft)).toBe(false);
  });
});

describe('the cilia tufts’ motion', () => {
  /** The phase, of `PHASE_SAMPLES` × 10, at which tuft `index` is longest. */
  function longestAt(index: number): number {
    const samples = PHASE_SAMPLES * 10;
    const lengths = Array.from(
      { length: samples },
      (_unused, step) => ciliaTuftAt(index, 1, { ...RESTING, ciliaPhase: step / samples }).lengthRadii,
    );
    return lengths.indexOf(Math.max(...lengths)) / samples;
  }

  it('beats in a wave that runs from the nose down both flanks to the tail', () => {
    const last = CILIA_TUFT_COUNT - 1;
    expect(longestAt(1)).toBeGreaterThan(longestAt(0));
    expect(longestAt(0)).toBeCloseTo(longestAt(last), 2);
    expect(longestAt(last - 1)).toBeCloseTo(longestAt(1), 2);
  });

  it('bends every tuft back toward the tail on its own side, and further with speed', () => {
    for (let index = 0; index < CILIA_TUFT_COUNT; index += 1) {
      const resting = ciliaTuftAt(index, 1, RESTING);
      const swimming = ciliaTuftAt(index, 1, { ...RESTING, speedRatio: 1 });
      expect(Math.sign(resting.lean)).toBe(Math.sign(Math.sin(tuftParameterOf(index))));
      expect(Math.abs(swimming.lean)).toBeGreaterThan(Math.abs(resting.lean));
    }
  });

  /**
   * Spaced by the polar angle, the tufts would bunch on the slipper's flanks and thin out at its ends (2.3 : 1 at tier
   * III); the spacing parameter brings that to about 1.5 : 1, the nose pair straddling the blunt front the widest.
   */
  it('spaces the tufts near-evenly along the outline at every tier', () => {
    for (const tier of TIERS) {
      const [terms] = walkTerms(tier, 0) as [RadialProfileTerms];
      const roots = ciliaTufts(aspectOf(tier), RESTING).map((tuft) => {
        const radius = membraneAt(terms, tuft.delta);
        return { x: radius * Math.cos(tuft.delta), y: radius * Math.sin(tuft.delta) };
      });
      const gaps = roots.map((root, index) => {
        const next = roots[(index + 1) % roots.length] ?? root;
        return Math.hypot(next.x - root.x, next.y - root.y);
      });
      expect(Math.max(...gaps) / Math.min(...gaps), `tier ${tier}`).toBeLessThan(1.6);
    }
  });

  it('roots the tufts all round the slipper, none on its axis', () => {
    const parameters = Array.from({ length: CILIA_TUFT_COUNT }, (_unused, index) => tuftParameterOf(index));
    expect(parameters.some((parameter) => Math.abs(parameter) < 1e-9)).toBe(false);
    expect(Math.max(...parameters) - Math.min(...parameters)).toBeCloseTo(
      RADIANS_PER_FULL_TURN * (1 - 1 / CILIA_TUFT_COUNT),
      9,
    );
  });
});

describe('ciliaTuftDrawnReachRadii', () => {
  it('reaches the full tuft and its cap past the membrane on the paramecium, and nothing on any other form', () => {
    expect(ciliaTuftDrawnReachRadii(formFor('paramecium_cilia'))).toBe(
      CILIA_TUFT_REACH_RADII + CILIA_TUFT_TIP_WIDTH_RADII * HALF,
    );
    expect(ciliaTuftDrawnReachRadii(formFor('amoeba_pseudopods'))).toBe(0);
    expect(ciliaTuftDrawnReachRadii(formFor(null))).toBe(0);
  });
});
