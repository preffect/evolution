// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, TRAIT_CATALOG, type TraitId } from '@evolution/shared';
import { PICKER_CARD_EFFECT_LINES_MAX } from '../hud-constants';
import { describeTierModifiers as describeTierModifiersIn, type TraitModifierTables } from './trait-effects';

const TIERS = [1, 2, 3];

/** The lines against `DEFAULT_BALANCE`, so every expectation below reads the shipped numbers. */
const describeTierModifiers = (traitId: TraitId, tier: number): string[] =>
  describeTierModifiersIn(DEFAULT_BALANCE.traits, traitId, tier);

/** A copy of the shipped tables, safe to patch. */
function patchableTables(): TraitModifierTables {
  const tables: TraitModifierTables = { ...DEFAULT_BALANCE.traits };
  tables.TRAIT_TIERS = { ...tables.TRAIT_TIERS };
  tables.DEFAULT_CELL_MODIFIERS = { ...tables.DEFAULT_CELL_MODIFIERS };
  return tables;
}

describe('describeTierModifiers', () => {
  it('reads a multiplier as a change from one and a delta with its unit (the flagellum’s tier I)', () => {
    expect(describeTierModifiers('simple_flagellum' as TraitId, 1)).toEqual([
      '+5 % speed',
      '+30 % sprint speed',
      '−0.5 s sprint cooldown',
    ]);
  });

  it('keeps the sign of a cost: the cell wall trades speed for resistance', () => {
    expect(describeTierModifiers('cell_wall' as TraitId, 2)).toEqual([
      '+30 % harder to engulf',
      '+40 % time to absorb you',
      '−10 % speed',
    ]);
  });

  it('never hides a cost: the diatom shell pairs its two spine lines and still ends on its speed', () => {
    expect(describeTierModifiers('diatom_shell' as TraitId, 1)).toEqual([
      '+40 % time to absorb you',
      'Spines drain 2 % / s, spit out 40 % / s',
      '−3 % speed',
    ]);
  });

  it('reads a shorter duration as the rate it gives, and a fraction as a share', () => {
    expect(describeTierModifiers('cytoskeleton' as TraitId, 3)).toEqual(['+64 % acceleration', '+30 % struggle']);
    expect(describeTierModifiers('nuclear_envelope' as TraitId, 3)).toEqual(['Keeps 75 % DNA on death']);
  });

  it('reads a gel floor below full speed as a floor, and one at full speed as no slowdown at all', () => {
    expect(describeTierModifiers('amoeba_pseudopods' as TraitId, 1)).toContain('Gel slows you to no less than 60 %');
    expect(describeTierModifiers('amoeba_pseudopods' as TraitId, 3)).toContain('Gel no longer slows you');
  });

  it('fits every catalog tier row on a card, so a row that outgrows it fails here instead of losing a line', () => {
    for (const trait of TRAIT_CATALOG) {
      for (const tier of TIERS) {
        expect(describeTierModifiers(trait.id, tier).length, `${trait.id} ${tier}`).toBeLessThanOrEqual(
          PICKER_CARD_EFFECT_LINES_MAX,
        );
      }
    }
  });

  it('keeps a line of headroom under the cap: the catalog’s longest row is three, the card holds four', () => {
    // Decision #425 set four as the ceiling, not a step on a ladder: when a tier legitimately reaches it this
    // number goes to four, and the line after that buys a bigger card or shorter words, never a bigger cap.
    const longestRow = Math.max(
      ...TRAIT_CATALOG.flatMap((trait) => TIERS.map((tier) => describeTierModifiers(trait.id, tier).length)),
    );
    expect(longestRow).toBe(3);
    expect(longestRow).toBeLessThan(PICKER_CARD_EFFECT_LINES_MAX);
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

  it('reads the tier tables it is given, so a patched balance changes the card and the shipped one does not move', () => {
    const patched = patchableTables();
    const [tierOne, , tierThree] = patched.TRAIT_TIERS.cell_wall;
    patched.TRAIT_TIERS.cell_wall = [tierOne, { membraneRatioBonus: 0.45, speedMultiplier: 0.8 }, tierThree];
    expect(describeTierModifiersIn(patched, 'cell_wall' as TraitId, 2)).toEqual([
      '+45 % harder to engulf',
      '−20 % speed',
    ]);
    expect(describeTierModifiers('cell_wall' as TraitId, 2)).toEqual([
      '+30 % harder to engulf',
      '+40 % time to absorb you',
      '−10 % speed',
    ]);
  });

  it('skips a value at the live identity, so a patched identity drops that line', () => {
    const patched = patchableTables();
    patched.DEFAULT_CELL_MODIFIERS.speedMultiplier = 0.9;
    expect(describeTierModifiersIn(patched, 'cell_wall' as TraitId, 2)).toEqual([
      '+30 % harder to engulf',
      '+40 % time to absorb you',
    ]);
  });

  it('reads a trait or tier the table does not hold as no lines', () => {
    expect(describeTierModifiers('no_such_trait' as TraitId, 1)).toEqual([]);
    expect(describeTierModifiers('cell_wall' as TraitId, 4)).toEqual([]);
  });
});
