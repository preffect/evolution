import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { TICK_INTERVAL_S } from '../constants/network.js';
import { DEFAULT_CELL_MODIFIERS } from '../constants/trait-modifiers.js';
import { engulfPredatorPaceModifiersOf, engulfPreyPaceModifiersOf } from './engulf-modifiers.js';
import {
  ENGULF_PHASE,
  engulfBaseRatePerTick,
  engulfMassFactor,
  engulfPhaseMultiplier,
  engulfPhaseOf,
  engulfProgressDelta,
  engulfStruggleSlowdown,
  predatorEngulfSpeedFactor,
  preyHeldSpeedFactor,
  spitOutChancePerTick,
  type EngulfPredatorPaceModifiers,
  type EngulfPreyPaceModifiers,
} from './engulf-pace.js';

const absorption = DEFAULT_BALANCE.absorption;
const identityPredator: EngulfPredatorPaceModifiers = engulfPredatorPaceModifiersOf(DEFAULT_CELL_MODIFIERS);
const identityPrey: EngulfPreyPaceModifiers = engulfPreyPaceModifiersOf(DEFAULT_CELL_MODIFIERS);
/** docs/ECOLOGY.md §8 E9: a 100-mass predator on a 20-mass prey pays out on tick 36. */
const E9_PREDATOR_MASS = 100;
const E9_PREY_MASS = 20;
const E9_TICKS = 36;
const PROGRESS_TOLERANCE = 1e-12;

describe('engulfPhaseOf', () => {
  it.each([
    [0, ENGULF_PHASE.cover],
    [absorption.ENGULF_WRAP_START_PROGRESS - absorption.ENGULF_PROGRESS_EPSILON, ENGULF_PHASE.wrap],
    [absorption.ENGULF_SEAL_PROGRESS - absorption.ENGULF_PROGRESS_EPSILON, ENGULF_PHASE.absorb],
    [1, ENGULF_PHASE.absorb],
  ])('reads progress %f as %s', (progress, phase) => {
    expect(engulfPhaseOf(progress, absorption)).toBe(phase);
  });

  it('keeps a tick that lands a hair short of a boundary on the far side of it', () => {
    const shortOfTheSeal = absorption.ENGULF_SEAL_PROGRESS - absorption.ENGULF_PROGRESS_EPSILON / 2;
    expect(engulfPhaseOf(shortOfTheSeal, absorption)).toBe(ENGULF_PHASE.absorb);
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
    expect(rate).toBeCloseTo(TICK_INTERVAL_S / absorption.ENGULF_BASE_DURATION_SECONDS, 12);
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

  it('decays at the escape multiplier when a wrap loses contact', () => {
    const escaping = { ...idleCoverInput, phase: ENGULF_PHASE.wrap, isInContact: false, awayEffort: 1 };
    expect(engulfProgressDelta(escaping, absorption)).toBeCloseTo(
      -absorption.ENGULF_ESCAPE_DECAY_MULTIPLIER / E9_TICKS,
      12,
    );
  });

  it('is zero for a cover that lost contact: the caller releases instead of decaying', () => {
    const lost = { ...idleCoverInput, isInContact: false };
    expect(engulfProgressDelta(lost, absorption)).toBe(0);
  });

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
    expect(progress).toBeCloseTo(1, PROGRESS_TOLERANCE);
  });
});

describe('preyHeldSpeedFactor', () => {
  it('is free in cover, held in wrap and zero once sealed', () => {
    expect(preyHeldSpeedFactor(ENGULF_PHASE.cover, 0, 0, absorption)).toBe(1);
    expect(preyHeldSpeedFactor(ENGULF_PHASE.wrap, 0, 0, absorption)).toBe(absorption.ENGULF_PREY_SPEED_FACTOR);
    expect(preyHeldSpeedFactor(ENGULF_PHASE.absorb, 0, 0, absorption)).toBe(0);
  });

  it('clamps a strong grip to the floor and a strong resistance to 1', () => {
    expect(preyHeldSpeedFactor(ENGULF_PHASE.wrap, 1, 0, absorption)).toBe(absorption.ENGULF_PREY_SPEED_FACTOR_FLOOR);
    expect(preyHeldSpeedFactor(ENGULF_PHASE.wrap, 0, 1, absorption)).toBe(1);
  });
});

describe('predatorEngulfSpeedFactor', () => {
  it('slows the predator before the seal and frees it after (E9b)', () => {
    expect(predatorEngulfSpeedFactor(ENGULF_PHASE.cover, absorption)).toBe(absorption.ENGULF_PREDATOR_SPEED_FACTOR);
    expect(predatorEngulfSpeedFactor(ENGULF_PHASE.wrap, absorption)).toBe(absorption.ENGULF_PREDATOR_SPEED_FACTOR);
    expect(predatorEngulfSpeedFactor(ENGULF_PHASE.absorb, absorption)).toBe(
      absorption.ENGULF_PREDATOR_SPEED_FACTOR_SEALED,
    );
  });
});

describe('spitOutChancePerTick', () => {
  it('converts a per-second chance to this tick (TRAITS T4: 0.4/s)', () => {
    expect(spitOutChancePerTick(0.4)).toBeCloseTo(0.4 / 60, 12);
    expect(spitOutChancePerTick(0)).toBe(0);
  });
});
