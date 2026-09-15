import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '@evolution/shared';
import { MODIFIER_LABELS, nonIdentityModifiers } from './modifier-labels';

const IDENTITY = DEFAULT_BALANCE.traits.DEFAULT_CELL_MODIFIERS;

describe('MODIFIER_LABELS', () => {
  it('labels exactly the modifiers of the identity record, so a new one without copy fails here', () => {
    expect(Object.keys(MODIFIER_LABELS).sort()).toEqual(Object.keys(IDENTITY).sort());
  });

  it('reads a range of one in the singular and every other range in the plural', () => {
    expect(MODIFIER_LABELS.toxinAuraRangeInRadii(1)).toBe('Toxin reaches 1 radius');
    expect(MODIFIER_LABELS.toxinAuraRangeInRadii(1.5)).toBe('Toxin reaches 1.5 radii');
    expect(MODIFIER_LABELS.attractRangeInRadii(1)).toBe('Pulls food from 1 radius');
    expect(MODIFIER_LABELS.attractRangeInRadii(3)).toBe('Pulls food from 3 radii');
  });

  it('reads a shorter duration as the rate it gives, a multiplier as its change and a delta with its unit', () => {
    expect(MODIFIER_LABELS.wrapDurationMultiplierAsPredator(0.5)).toBe('+100 % wrap speed');
    expect(MODIFIER_LABELS.absorbDurationMultiplierAsPredator(0.8)).toBe('+25 % absorb speed');
    expect(MODIFIER_LABELS.speedMultiplier(0.9)).toBe('−10 % speed');
    expect(MODIFIER_LABELS.sprintCooldownSecondsDelta(-0.5)).toBe('−0.5 s sprint cooldown');
    expect(MODIFIER_LABELS.photosynthesisMassPerSecond(0.3)).toBe('+0.3 mass / s in sunlight');
    expect(MODIFIER_LABELS.spitOutChancePerSecond(0.05)).toBe('5 % / s spit-out chance');
    expect(MODIFIER_LABELS.attractSpeed(40)).toBe('Food drifts in at 40 u/s');
  });

  it('reads a gel floor below full speed as a floor, and one at full speed as no slowdown at all', () => {
    expect(MODIFIER_LABELS.gelSpeedFactorFloor(0.6)).toBe('Gel slows you to no less than 60 %');
    expect(MODIFIER_LABELS.gelSpeedFactorFloor(1)).toBe('Gel no longer slows you');
  });
});

describe('nonIdentityModifiers', () => {
  it('keeps the row’s own order and skips a value at its identity', () => {
    const row = { membraneRatioBonus: 0.3, speedMultiplier: IDENTITY.speedMultiplier, decayMultiplier: 0.9 };
    expect(nonIdentityModifiers(row, IDENTITY)).toEqual([
      ['membraneRatioBonus', 0.3],
      ['decayMultiplier', 0.9],
    ]);
  });

  it('compares against the identity it is given, so a patched identity moves what counts as a change', () => {
    const row = { speedMultiplier: 1.05 };
    expect(nonIdentityModifiers(row, { ...IDENTITY, speedMultiplier: 1.05 })).toEqual([]);
    expect(nonIdentityModifiers(row, IDENTITY)).toEqual([['speedMultiplier', 1.05]]);
  });

  it('reads an empty row as no modifiers', () => {
    expect(nonIdentityModifiers({}, IDENTITY)).toEqual([]);
  });
});
