import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, type CellModifiers } from '@evolution/shared';
import { MODIFIER_LABELS, modifierLine, nonIdentityModifiers } from './modifier-labels';

const IDENTITY = DEFAULT_BALANCE.traits.DEFAULT_CELL_MODIFIERS;
const KEYS = Object.keys(MODIFIER_LABELS) as (keyof CellModifiers)[];

describe('MODIFIER_LABELS', () => {
  it('labels exactly the modifiers of the identity record, so a new one without copy fails here', () => {
    expect([...KEYS].sort()).toEqual(Object.keys(IDENTITY).sort());
  });

  it('gives every modifier a noun with no figure in it, and a value that is a figure', () => {
    for (const key of KEYS) {
      const { noun, formatValue } = MODIFIER_LABELS[key];
      expect(noun, key).toMatch(/^[A-Za-z][A-Za-z -]*$/);
      expect(formatValue(0.5), key).toMatch(/\d/);
      expect(formatValue(0.5), key).not.toContain(noun);
    }
  });

  it('keeps the value beside its noun for the encyclopedia’s fact table', () => {
    expect(MODIFIER_LABELS.decayMultiplier.noun).toBe('mass decay');
    expect(MODIFIER_LABELS.decayMultiplier.formatValue(0.85)).toBe('−15 %');
    expect(MODIFIER_LABELS.toxinAuraRangeInRadii.noun).toBe('toxin reach');
    expect(MODIFIER_LABELS.toxinAuraRangeInRadii.formatValue(1.5)).toBe('1.5 radii');
  });
});

describe('modifierLine', () => {
  it('reads a range of one in the singular and every other range in the plural', () => {
    expect(modifierLine('toxinAuraRangeInRadii', 1)).toBe('Toxin reaches 1 radius');
    expect(modifierLine('toxinAuraRangeInRadii', 1.5)).toBe('Toxin reaches 1.5 radii');
    expect(modifierLine('attractRangeInRadii', 1)).toBe('Pulls food from 1 radius');
    expect(modifierLine('attractRangeInRadii', 3)).toBe('Pulls food from 3 radii');
  });

  it('joins the value and the noun: a shorter duration as its rate, a multiplier as its change, a delta with its unit', () => {
    expect(modifierLine('wrapDurationMultiplierAsPredator', 0.5)).toBe('+100 % wrap speed');
    expect(modifierLine('absorbDurationMultiplierAsPredator', 0.8)).toBe('+25 % absorb speed');
    expect(modifierLine('speedMultiplier', 0.9)).toBe('−10 % speed');
    expect(modifierLine('sprintCooldownSecondsDelta', -0.5)).toBe('−0.5 s sprint cooldown');
    expect(modifierLine('photosynthesisMassPerSecond', 0.3)).toBe('+0.3 mass / s in sunlight');
    expect(modifierLine('spitOutChancePerSecond', 0.05)).toBe('5 % / s spit-out chance');
  });

  it('reads a sentence-shaped row through its own line', () => {
    expect(modifierLine('attractSpeed', 40)).toBe('Food drifts in at 40 u/s');
    expect(modifierLine('spikeDrainFractionPerSecond', 0.02)).toBe('Spines drain 2 % / s');
    expect(modifierLine('dnaKeptOnDeathFraction', 0.75)).toBe('Keeps 75 % DNA on death');
    expect(modifierLine('gelSpeedFactorFloor', 0.6)).toBe('Gel slows you to no less than 60 %');
    expect(modifierLine('gelSpeedFactorFloor', 1)).toBe('Gel no longer slows you');
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
