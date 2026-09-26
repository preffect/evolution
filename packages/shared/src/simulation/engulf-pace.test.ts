import { describe, expect, it } from 'vitest';
import { ENGULF_ABSORB_SECONDS, ENGULF_COVER_SECONDS, ENGULF_WRAP_SECONDS } from '../constants/absorption.js';
import {
  ENGULF_BASE_DURATION_SECONDS,
  ENGULF_SEAL_PROGRESS,
  ENGULF_WRAP_START_PROGRESS,
} from '../constants/absorption-derived.js';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { TICK_INTERVAL_S } from '../constants/network.js';
import { DEFAULT_CELL_MODIFIERS } from '../constants/trait-modifiers.js';
import {
  ENGULF_PHASE,
  engulfBaseDurationSeconds,
  engulfBaseRatePerTick,
  engulfMassFactor,
  engulfPhaseMultiplier,
  engulfPhaseOf,
  engulfPhaseSpanSeconds,
  engulfProgressDelta,
  engulfSealProgress,
  engulfStruggleSlowdown,
  engulfWrapStartProgress,
  predatorEngulfSpeedFactor,
  preyHeldSpeedFactor,
  spitOutChancePerTick,
  type EngulfPredatorPaceModifiers,
  type EngulfPreyPaceModifiers,
} from './engulf-pace.js';

const absorption = DEFAULT_BALANCE.absorption;
/** The folded record of a cell with no traits: every pace term at its identity (docs/traits/model.md §2). */
const identityPredator: EngulfPredatorPaceModifiers = DEFAULT_CELL_MODIFIERS;
const identityPrey: EngulfPreyPaceModifiers = DEFAULT_CELL_MODIFIERS;
/** docs/ecology/acceptance.md §8 E9: a 100-mass predator on a 20-mass prey pays out on tick 36. */
const E9_PREDATOR_MASS = 100;
const E9_PREY_MASS = 20;
const E9_TICKS = 36;
const PROGRESS_TOLERANCE = 1e-12;

/**
 * The default absorption rows with one retuned, as `debug_set_balance` hands them over. Assigned rather than
 * written as an object-literal key because the lint's naming rule reads `ENGULF_*` in a literal as a badly named
 * key; it is the balance's own key.
 */
function withAbsorption(
  key: 'ENGULF_COVER_SECONDS' | 'ENGULF_WRAP_SECONDS' | 'ENGULF_ABSORB_SECONDS',
  value: number,
): typeof absorption {
  const patched = { ...absorption };
  patched[key] = value;
  return patched;
}

/**
 * docs/ecology/absorption.md §6.1: the base duration and the two bands are the phase seconds' sum and shares, derived
 * at read time. At the defaults they are bit-identical to the module constants the docs and the ledger name, and the
 * base is exactly 1.2, the float the doc pins (absorb-first; cover-first gives 1.2000000000000002).
 */
describe('the derived engulf pace', () => {
  it('gives the documented defaults exactly', () => {
    expect(engulfBaseDurationSeconds(absorption)).toBe(1.2);
    expect(engulfBaseDurationSeconds(absorption)).toBe(ENGULF_BASE_DURATION_SECONDS);
    expect(engulfWrapStartProgress(absorption)).toBe(ENGULF_WRAP_START_PROGRESS);
    expect(engulfWrapStartProgress(absorption)).toBeCloseTo(1 / 6, 15);
    expect(engulfSealProgress(absorption)).toBe(0.5);
    expect(engulfSealProgress(absorption)).toBe(ENGULF_SEAL_PROGRESS);
  });

  it('follows a patched phase second', () => {
    const longerWrap = withAbsorption('ENGULF_WRAP_SECONDS', 1.0);
    expect(engulfBaseDurationSeconds(longerWrap)).toBeCloseTo(1.8, 12);
    expect(engulfWrapStartProgress(longerWrap)).toBeCloseTo(1 / 9, 12);
    expect(engulfSealProgress(longerWrap)).toBeCloseTo(2 / 3, 12);
  });
});

describe('engulfPhaseOf', () => {
  it.each([
    [0, ENGULF_PHASE.cover],
    [ENGULF_WRAP_START_PROGRESS - absorption.ENGULF_PROGRESS_EPSILON, ENGULF_PHASE.wrap],
    [ENGULF_SEAL_PROGRESS - absorption.ENGULF_PROGRESS_EPSILON, ENGULF_PHASE.absorb],
    [1, ENGULF_PHASE.absorb],
  ])('reads progress %f as %s', (progress, phase) => {
    expect(engulfPhaseOf(progress, absorption)).toBe(phase);
  });

  it('keeps a tick that lands a hair short of a boundary on the far side of it', () => {
    const shortOfTheSeal = ENGULF_SEAL_PROGRESS - absorption.ENGULF_PROGRESS_EPSILON / 2;
    expect(engulfPhaseOf(shortOfTheSeal, absorption)).toBe(ENGULF_PHASE.absorb);
  });
});

describe('engulfPhaseSpanSeconds', () => {
  const phases = Object.values(ENGULF_PHASE);
  const spansOf = (balance: typeof absorption): number[] =>
    phases.map((phase) => engulfPhaseSpanSeconds(phase, balance));

  /** docs/ecology/constants.md §7: the bands are the phase seconds' shares, so the spans give them back. */
  it('reads the three phase seconds back out of the bands', () => {
    expect(spansOf(absorption)).toEqual([
      expect.closeTo(ENGULF_COVER_SECONDS, 12),
      expect.closeTo(ENGULF_WRAP_SECONDS, 12),
      expect.closeTo(ENGULF_ABSORB_SECONDS, 12),
    ]);
  });

  it('sums to the base duration over the three phases', () => {
    const total = spansOf(absorption).reduce((sum, span) => sum + span, 0);
    expect(total).toBeCloseTo(ENGULF_BASE_DURATION_SECONDS, 12);
  });

  /**
   * The phase seconds, patched as `debug_set_balance` would: a longer wrap stretches the wrap span alone and leaves
   * the cover and the absorb as they were; the whole engulf lengthens by the same amount (#367).
   */
  it('follows a patched phase second, the leaf the engulf itself reads', () => {
    const [cover, wrap, absorb] = spansOf(withAbsorption('ENGULF_WRAP_SECONDS', 1.0));
    expect(cover).toBeCloseTo(ENGULF_COVER_SECONDS, 12);
    expect(wrap).toBeCloseTo(1.0, 12);
    expect(absorb).toBeCloseTo(ENGULF_ABSORB_SECONDS, 12);
    const [, , longerAbsorb] = spansOf(withAbsorption('ENGULF_ABSORB_SECONDS', 0.9));
    expect(longerAbsorb).toBeCloseTo(0.9, 12);
  });
});

describe('engulfMassFactor', () => {
  it('is 1 at exactly the required ratio: the base duration, no faster', () => {
    expect(engulfMassFactor(absorption.ENGULF_MASS_RATIO * E9_PREY_MASS, E9_PREY_MASS, absorption)).toBe(1);
  });

  it('floors at ENGULF_MIN_DURATION_FACTOR for a far heavier predator (E9 ratio 5)', () => {
    expect(engulfMassFactor(E9_PREDATOR_MASS, E9_PREY_MASS, absorption)).toBe(absorption.ENGULF_MIN_DURATION_FACTOR);
  });

  it('never exceeds 1 when the predator is barely over the release ratio (E16)', () => {
    expect(engulfMassFactor(23, 20, absorption)).toBe(1);
  });
});

describe('engulfBaseRatePerTick', () => {
  it('pays out in 36 ticks at the E9 ratio', () => {
    const rate = engulfBaseRatePerTick(E9_PREDATOR_MASS, E9_PREY_MASS, absorption);
    expect(rate).toBeCloseTo(1 / E9_TICKS, 12);
    expect(rate * E9_TICKS).toBeCloseTo(1, 12);
  });

  it('takes the full base duration at exactly the required ratio', () => {
    const rate = engulfBaseRatePerTick(absorption.ENGULF_MASS_RATIO * E9_PREY_MASS, E9_PREY_MASS, absorption);
    expect(rate).toBeCloseTo(TICK_INTERVAL_S / ENGULF_BASE_DURATION_SECONDS, 12);
  });
});

describe('engulfPhaseMultiplier', () => {
  it('is 1 in cover whatever the traits say', () => {
    const slowPrey = { ...identityPrey, absorbDurationMultiplierAsPrey: 2 };
    expect(engulfPhaseMultiplier(ENGULF_PHASE.cover, identityPredator, slowPrey)).toBe(1);
  });

  it('takes the predator alone in wrap and both sides in absorb', () => {
    const predator = {
      ...identityPredator,
      wrapDurationMultiplierAsPredator: 0.5,
      absorbDurationMultiplierAsPredator: 0.8,
    };
    const prey = { ...identityPrey, absorbDurationMultiplierAsPrey: 1.5 };
    expect(engulfPhaseMultiplier(ENGULF_PHASE.wrap, predator, prey)).toBe(0.5);
    expect(engulfPhaseMultiplier(ENGULF_PHASE.absorb, predator, prey)).toBeCloseTo(1.2, 12);
  });
});

describe('engulfStruggleSlowdown', () => {
  it('is zero without effort and halves the pace at full effort (E11)', () => {
    expect(engulfStruggleSlowdown(0, 0, absorption)).toBe(0);
    expect(engulfStruggleSlowdown(1, 0, absorption)).toBe(absorption.ENGULF_STRUGGLE_SLOWDOWN);
  });

  it('scales with the effort and caps the trait bonus', () => {
    expect(engulfStruggleSlowdown(0.5, 0, absorption)).toBeCloseTo(absorption.ENGULF_STRUGGLE_SLOWDOWN / 2, 12);
    expect(engulfStruggleSlowdown(1, 1, absorption)).toBe(absorption.ENGULF_STRUGGLE_SLOWDOWN_CAP);
  });
});

describe('engulfProgressDelta', () => {
  const idleCoverInput = {
    phase: ENGULF_PHASE.cover,
    predatorMass: E9_PREDATOR_MASS,
    preyMass: E9_PREY_MASS,
    isInContact: true,
    awayEffort: 0,
    predator: identityPredator,
    prey: identityPrey,
  };

  it('advances by 1/36 per tick while the prey does not fight (E9)', () => {
    expect(engulfProgressDelta(idleCoverInput, absorption)).toBeCloseTo(1 / E9_TICKS, 12);
  });

  it('halves to 1/72 when the prey steers straight away (E11)', () => {
    const struggling = { ...idleCoverInput, phase: ENGULF_PHASE.wrap, awayEffort: 1 };
    expect(engulfProgressDelta(struggling, absorption)).toBeCloseTo(1 / 72, 12);
  });

  it.each([ENGULF_PHASE.cover, ENGULF_PHASE.wrap])(
    'decays at the escape multiplier when a %s loses contact: a slip drains, it does not cancel (#634)',
    (phase) => {
      const escaping = { ...idleCoverInput, phase, isInContact: false, awayEffort: 1 };
      expect(engulfProgressDelta(escaping, absorption)).toBeCloseTo(
        -absorption.ENGULF_ESCAPE_DECAY_MULTIPLIER / E9_TICKS,
        12,
      );
    },
  );

  it('ignores the struggle once sealed: the prey is carried', () => {
    const sealed = { ...idleCoverInput, phase: ENGULF_PHASE.absorb, awayEffort: 1 };
    expect(engulfProgressDelta(sealed, absorption)).toBeCloseTo(1 / E9_TICKS, 12);
  });

  it('sums to exactly one payout over the documented 36 ticks', () => {
    let progress = 0;
    for (let tick = 0; tick < E9_TICKS; tick += 1) {
      progress += engulfProgressDelta({ ...idleCoverInput, phase: engulfPhaseOf(progress, absorption) }, absorption);
    }
    expect(progress).toBeGreaterThanOrEqual(1 - absorption.ENGULF_PROGRESS_EPSILON);
    expect(Math.abs(progress - 1)).toBeLessThanOrEqual(PROGRESS_TOLERANCE);
  });
});

describe('preyHeldSpeedFactor', () => {
  it('grabs mildly in cover, holds in wrap and is zero once sealed', () => {
    expect(preyHeldSpeedFactor(ENGULF_PHASE.cover, 0, 0, absorption)).toBe(absorption.ENGULF_PREY_SPEED_FACTOR_COVER);
    expect(preyHeldSpeedFactor(ENGULF_PHASE.wrap, 0, 0, absorption)).toBe(absorption.ENGULF_PREY_SPEED_FACTOR);
    expect(preyHeldSpeedFactor(ENGULF_PHASE.absorb, 0, 0, absorption)).toBe(0);
  });

  it.each([ENGULF_PHASE.cover, ENGULF_PHASE.wrap])('moves the %s factor by the grip and the resistance', (phase) => {
    const unmoved = preyHeldSpeedFactor(phase, 0, 0, absorption);
    const grip = 0.1;
    const resistance = 0.05;
    expect(preyHeldSpeedFactor(phase, grip, 0, absorption)).toBeCloseTo(unmoved - grip, 12);
    expect(preyHeldSpeedFactor(phase, 0, resistance, absorption)).toBeCloseTo(unmoved + resistance, 12);
  });

  it.each([ENGULF_PHASE.cover, ENGULF_PHASE.wrap])(
    'clamps a strong grip to the floor and a strong resistance to 1 in %s',
    (phase) => {
      expect(preyHeldSpeedFactor(phase, 1, 0, absorption)).toBe(absorption.ENGULF_PREY_SPEED_FACTOR_FLOOR);
      expect(preyHeldSpeedFactor(phase, 0, 1, absorption)).toBe(1);
    },
  );
});

describe('predatorEngulfSpeedFactor', () => {
  it('reads the grab factor before the seal and the sealed factor after (E9b)', () => {
    expect(predatorEngulfSpeedFactor(ENGULF_PHASE.cover, absorption)).toBe(absorption.ENGULF_PREDATOR_SPEED_FACTOR);
    expect(predatorEngulfSpeedFactor(ENGULF_PHASE.wrap, absorption)).toBe(absorption.ENGULF_PREDATOR_SPEED_FACTOR);
    expect(predatorEngulfSpeedFactor(ENGULF_PHASE.absorb, absorption)).toBe(
      absorption.ENGULF_PREDATOR_SPEED_FACTOR_SEALED,
    );
  });

  // docs/ecology/absorption.md §6.1 "The grab": a predator is never slower than the prey it holds, so a close chase
  // does not open the gap the grab just closed (#634). Both share one top speed (#677), so the factors decide it.
  it.each([ENGULF_PHASE.cover, ENGULF_PHASE.wrap])('keeps a predator at least as fast as its %s prey', (phase) => {
    const topSpeed = DEFAULT_BALANCE.growth.CELL_BASE_SPEED;
    const predatorSpeed = topSpeed * predatorEngulfSpeedFactor(phase, absorption);
    const preySpeed = topSpeed * preyHeldSpeedFactor(phase, 0, 0, absorption);
    expect(predatorSpeed).toBeGreaterThanOrEqual(preySpeed);
  });
});

describe('spitOutChancePerTick', () => {
  it('converts a per-second chance to this tick (TRAITS T4: 0.4/s)', () => {
    expect(spitOutChancePerTick(0.4)).toBeCloseTo(0.4 / 60, 12);
    expect(spitOutChancePerTick(0)).toBe(0);
  });
});
