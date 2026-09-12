// The one adapter from a cell's folded `CellModifiers` onto the engulf pace's modifier halves
// (docs/ECOLOGY.md §6.1, docs/TRAITS.md §2). It exists because the modifier rework #260 describes
// has not landed: `CellModifiers` still carries the coarse `engulfDurationMultiplierAs*` pair and
// none of `gripStrengthBonus`, `gripResistanceBonus`, `struggleSlowdownBonus` or
// `spitOutChancePerSecond`. The engulf lifecycle (#258) therefore reads the pace names through
// here and every trait effect stays at its identity for now.
//
// #260 renames the fields in `CellModifiers` and fills the tier tables; when it does, the two
// functions below become straight `Pick`s and nothing else in the engulf step changes.

import type { CellModifiers } from '../types/traits.js';
import type { EngulfPredatorPaceModifiers, EngulfPreyPaceModifiers } from './engulf-pace.js';

/** No trait grips harder or slips more until #260 wires the modifiers, so the bonuses are the identity. */
const NO_BONUS = 0;
/** No prey rolls a spit-out until #260 gives the Diatom Shell its chance (docs/TRAITS.md §3.15). */
const NO_SPIT_OUT_CHANCE_PER_SECOND = 0;

/** The predator's pace modifiers: the whole-engulf predator multiplier scales both of its phases. */
export function engulfPredatorPaceModifiersOf(modifiers: CellModifiers): EngulfPredatorPaceModifiers {
  return {
    wrapDurationMultiplierAsPredator: modifiers.engulfDurationMultiplierAsPredator,
    absorbDurationMultiplierAsPredator: modifiers.engulfDurationMultiplierAsPredator,
    gripStrengthBonus: NO_BONUS,
  };
}

/** The prey's pace modifiers: its whole-engulf multiplier is the absorb one (#260 renames it). */
export function engulfPreyPaceModifiersOf(modifiers: CellModifiers): EngulfPreyPaceModifiers {
  return {
    absorbDurationMultiplierAsPrey: modifiers.engulfDurationMultiplierAsPrey,
    gripResistanceBonus: NO_BONUS,
    struggleSlowdownBonus: NO_BONUS,
    spitOutChancePerSecond: NO_SPIT_OUT_CHANCE_PER_SECOND,
  };
}
