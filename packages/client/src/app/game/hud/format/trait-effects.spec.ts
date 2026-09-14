import { describe, expect, it } from 'vitest';
import { DEFAULT_CELL_MODIFIERS, TRAIT_CATALOG, type TraitId } from '@evolution/shared';
import { PICKER_CARD_EFFECT_LINES_MAX } from '../hud-constants';
import { MODIFIER_LABELS, describeTierModifiers, nonIdentityModifiers } from './trait-effects';

const TIERS = [1, 2, 3];

describe('MODIFIER_LABELS', () => {
  it('labels exactly the modifiers of DEFAULT_CELL_MODIFIERS, so a new one without copy fails here', () => {
    expect(Object.keys(MODIFIER_LABELS).sort()).toEqual(Object.keys(DEFAULT_CELL_MODIFIERS).sort());
  });

  it('reads a range of one in the singular and every other range in the plural', () => {
    expect(MODIFIER_LABELS.toxinAuraRangeInRadii(1)).toBe('Toxin reaches 1 radius');
    expect(MODIFIER_LABELS.toxinAuraRangeInRadii(1.5)).toBe('Toxin reaches 1.5 radii');
    expect(MODIFIER_LABELS.attractRangeInRadii(1)).toBe('Pulls food from 1 radius');
    expect(MODIFIER_LABELS.attractRangeInRadii(3)).toBe('Pulls food from 3 radii');
  });
});

describe('describeTierModifiers', () => {
  it('reads a multiplier as a change from one and a delta with its unit (the flagellum’s tier I)', () => {
    expect(describeTierModifiers('simple_flagellum' as TraitId, 1)).toEqual([
      '+5 % speed',
      '+30 % sprint speed',
      '−0.5 s sprint cooldown',
    ]);
  });

  it('keeps the sign of a cost: the cell wall trades speed for resistance', () => {
    expect(describeTierModifiers('cell_wall' as TraitId, 2)).toEqual(['+30 % harder to engulf', '−10 % speed']);
  });

  it('never hides a cost: the diatom shell’s third line is its speed', () => {
    expect(describeTierModifiers('diatom_shell' as TraitId, 1)).toEqual([
      '+40 % time to absorb you',
      'Spines drain 2 % / s',
      '−3 % speed',
    ]);
  });

  it('reads a shorter duration as the rate it gives, and a fraction as a share', () => {
    expect(describeTierModifiers('cytoskeleton' as TraitId, 3)).toEqual(['+64 % acceleration']);
    expect(MODIFIER_LABELS.wrapDurationMultiplierAsPredator(0.5)).toBe('+100 % wrap speed');
    expect(MODIFIER_LABELS.absorbDurationMultiplierAsPredator(0.8)).toBe('+25 % absorb speed');
    expect(describeTierModifiers('nuclear_envelope' as TraitId, 3)).toEqual(['Keeps 75 % DNA on death']);
  });

  it('reads a gel floor below full speed as a floor, and one at full speed as no slowdown at all', () => {
    expect(describeTierModifiers('amoeba_pseudopods' as TraitId, 1)).toContain('Gel slows you to no less than 60 %');
    expect(describeTierModifiers('amoeba_pseudopods' as TraitId, 3)).toContain('Gel no longer slows you');
  });

  it('fits every catalog tier row on a card, so a row that outgrows it fails here instead of losing a line', () => {
    for (const trait of TRAIT_CATALOG) {
      for (const tier of TIERS) {
        expect(nonIdentityModifiers(trait.id, tier).length, `${trait.id} ${tier}`).toBeLessThanOrEqual(
          PICKER_CARD_EFFECT_LINES_MAX,
        );
      }
    }
  });

  it('gives every catalog trait at every tier readable lines and never a raw number or undefined', () => {
    for (const trait of TRAIT_CATALOG) {
      for (const tier of TIERS) {
        const lines = describeTierModifiers(trait.id, tier);
        expect(lines.length, `${trait.id} ${tier}`).toBeGreaterThan(0);
        for (const line of lines) {
          expect(line).not.toMatch(/undefined|NaN/);
          // A word as well as the figure: `+15 %` alone would be a raw number.
          expect(line, `${trait.id} ${tier}`).toMatch(/[A-Za-z]{2,}/);
        }
      }
    }
  });
});
