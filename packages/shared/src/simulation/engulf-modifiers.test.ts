import { describe, expect, it } from 'vitest';
import { DEFAULT_CELL_MODIFIERS } from '../constants/trait-modifiers.js';
import { engulfPredatorPaceModifiersOf, engulfPreyPaceModifiersOf } from './engulf-modifiers.js';

describe('engulf pace modifier adapter (#260 fills these)', () => {
  it('maps the default modifiers onto the identity of every pace term', () => {
    expect(engulfPredatorPaceModifiersOf(DEFAULT_CELL_MODIFIERS)).toEqual({
      wrapDurationMultiplierAsPredator: 1,
      absorbDurationMultiplierAsPredator: 1,
      gripStrengthBonus: 0,
    });
    expect(engulfPreyPaceModifiersOf(DEFAULT_CELL_MODIFIERS)).toEqual({
      absorbDurationMultiplierAsPrey: 1,
      gripResistanceBonus: 0,
      struggleSlowdownBonus: 0,
      spitOutChancePerSecond: 0,
    });
  });

  it("carries today's coarse predator multiplier into both of its phases", () => {
    const modifiers = { ...DEFAULT_CELL_MODIFIERS, engulfDurationMultiplierAsPredator: 0.8 };
    const pace = engulfPredatorPaceModifiersOf(modifiers);
    expect(pace.wrapDurationMultiplierAsPredator).toBe(0.8);
    expect(pace.absorbDurationMultiplierAsPredator).toBe(0.8);
  });

  it("carries today's coarse prey multiplier into the absorb phase", () => {
    const modifiers = { ...DEFAULT_CELL_MODIFIERS, engulfDurationMultiplierAsPrey: 1.4 };
    expect(engulfPreyPaceModifiersOf(modifiers).absorbDurationMultiplierAsPrey).toBe(1.4);
  });
});
