// The one file where a formula fact's number is computed (docs/architecture/encyclopedia.md §12.3). Each row is
// exactly one call of the shared function the simulation calls, over the live balance, with a number-free argument
// (an id or a closed selector). Content names a row and its argument; it can never write a closure, a sum or a
// factor. A new row is reviewed here. `engulf_phase_span` lands with its shared function in #362.

import { levelUpCost, maxSpeedForMass, radiusForMass, type BalanceConfig, type ValueOf } from '@evolution/shared';

/** A mass the balance names: the starting mass and the cap. */
export const BALANCE_MASS = { starting: 'starting', max: 'max' } as const;
export type BalanceMass = ValueOf<typeof BALANCE_MASS>;

/** A level the balance bounds: the first level-up and the last one (into `MAX_LEVEL`). */
export const LEVEL_SELECTOR = { first: 'first', last: 'last' } as const;
export type LevelSelector = ValueOf<typeof LEVEL_SELECTOR>;

export const FACT_FORMULA = {
  /** `radiusForMass(massOf(argument), balance.growth)`. */
  radiusAtMass: 'radius_at_mass',
  /** `maxSpeedForMass(massOf(argument), balance.growth)`. */
  maxSpeedAtMass: 'max_speed_at_mass',
  /** `levelUpCost(levelOf(argument), balance.progression)`. */
  levelUpCostAt: 'level_up_cost_at',
} as const;
export type FactFormulaId = ValueOf<typeof FACT_FORMULA>;

/** Each formula's argument: ids and closed selectors only, never a number. */
export interface FactFormulaArguments {
  [FACT_FORMULA.radiusAtMass]: { readonly mass: BalanceMass };
  [FACT_FORMULA.maxSpeedAtMass]: { readonly mass: BalanceMass };
  [FACT_FORMULA.levelUpCostAt]: { readonly level: LevelSelector };
}

export type FactFormulaCall = {
  [Id in FactFormulaId]: { readonly id: Id; readonly argument: FactFormulaArguments[Id] };
}[FactFormulaId];

const FIRST_LEVEL = 1;
/** `levelUpCost(level)` is the cost from `level` to the next, so the last level-up starts one below the cap. */
const LEVELS_BELOW_CAP_OF_LAST_LEVEL_UP = 1;

function massOf(balance: BalanceConfig, mass: BalanceMass): number {
  return mass === BALANCE_MASS.starting ? balance.growth.CELL_STARTING_MASS : balance.growth.CELL_MAX_MASS;
}

function levelOf(balance: BalanceConfig, level: LevelSelector): number {
  return level === LEVEL_SELECTOR.first
    ? FIRST_LEVEL
    : balance.progression.MAX_LEVEL - LEVELS_BELOW_CAP_OF_LAST_LEVEL_UP;
}

export const FACT_FORMULAS: {
  readonly [Id in FactFormulaId]: (balance: BalanceConfig, argument: FactFormulaArguments[Id]) => number;
} = {
  [FACT_FORMULA.radiusAtMass]: (balance, argument) => radiusForMass(massOf(balance, argument.mass), balance.growth),
  [FACT_FORMULA.maxSpeedAtMass]: (balance, argument) => maxSpeedForMass(massOf(balance, argument.mass), balance.growth),
  [FACT_FORMULA.levelUpCostAt]: (balance, argument) =>
    levelUpCost(levelOf(balance, argument.level), balance.progression),
};

export function evaluateFormula(balance: BalanceConfig, call: FactFormulaCall): number {
  const formula = FACT_FORMULAS[call.id] as (balance: BalanceConfig, argument: FactFormulaCall['argument']) => number;
  return formula(balance, call.argument);
}
