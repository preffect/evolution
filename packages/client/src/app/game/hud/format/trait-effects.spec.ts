import { describe, expect, it } from 'vitest';
import { DEFAULT_CELL_MODIFIERS, TRAIT_CATALOG, type TraitId } from '@evolution/shared';
import { PICKER_CARD_EFFECT_LINES_MAX } from '../hud-constants';
import { MODIFIER_LABELS, describeTierModifiers } from './trait-effects';

const TIERS = [1, 2, 3];

describe('MODIFIER_LABELS', () => {
  it('labels exactly the modifiers of DEFAULT_CELL_MODIFIERS, so a new one without copy fails here', () => {
    expect(Object.keys(MODIFIER_LABELS).sort()).toEqual(Object.keys(DEFAULT_CELL_MODIFIERS).sort());
  });
});

describe('describeTierModifiers', () => {
  it('reads a multiplier as a change from one and a delta with its unit (the flagellum’s tier I)', () => {
    expect(describeTierModifiers('simple_flagellum' as TraitId, 1)).toEqual(['+5 % speed', '+30 % sprint speed']);
  });

  it('keeps the sign of a cost: the cell wall trades speed for resistance', () => {
    expect(describeTierModifiers('cell_wall' as TraitId, 2)).toEqual(['+30 % harder to engulf', '−10 % speed']);
  });

  it('reads a shorter duration as quicker, and a fraction as a share', () => {
    expect(describeTierModifiers('cytoskeleton' as TraitId, 1)).toEqual(['+15 % acceleration']);
    expect(describeTierModifiers('nuclear_envelope' as TraitId, 3)).toEqual(['Keeps 75 % DNA on death']);
  });

  it('reads a gel floor below full speed as a floor, and one at full speed as no slowdown at all', () => {
    expect(describeTierModifiers('amoeba_pseudopods' as TraitId, 1)).toContain('Gel slows you to no less than 60 %');
    expect(describeTierModifiers('amoeba_pseudopods' as TraitId, 3)).toContain('Gel no longer slows you');
  });

  it('gives every catalog trait at every tier one or two readable lines and never a raw number or undefined', () => {
    for (const trait of TRAIT_CATALOG) {
      for (const tier of TIERS) {
        const lines = describeTierModifiers(trait.id, tier);
        expect(lines.length, `${trait.id} ${tier}`).toBeGreaterThan(0);
        expect(lines.length).toBeLessThanOrEqual(PICKER_CARD_EFFECT_LINES_MAX);
        for (const line of lines) {
          expect(line).not.toMatch(/undefined|NaN/);
          // A word as well as the figure: `+15 %` alone would be a raw number.
          expect(line, `${trait.id} ${tier}`).toMatch(/[A-Za-z]{2,}/);
        }
      }
    }
  });
});
