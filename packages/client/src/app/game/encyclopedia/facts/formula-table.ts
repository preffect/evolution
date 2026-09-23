// The one file where a formula fact's number is computed (docs/architecture/encyclopedia.md §12.3). Each row is
// exactly one call of the shared function the simulation calls, over the live balance, with a number-free argument
// (an id or a closed selector). Content names a row and its argument; it can never write a closure, a sum or a
// factor. A new row is reviewed here. `engulf_phase_span` lands with its shared function in #362.

import {
  FIRST_LEVEL,
  gelSpeedFactor,
  levelUpCost,
  maxSpeedForMass,
  radiusForMass,
  worldReference,
  type BalanceConfig,
  type ValueOf,
} from '@evolution/shared';

/** A mass the balance names: the starting mass and the cap. */
export const BALANCE_MASS = { starting: 'starting', max: 'max' } as const;
export type BalanceMass = ValueOf<typeof BALANCE_MASS>;

/** A level the balance bounds: the first level-up and the last one (into `MAX_LEVEL`). */
export const LEVEL_SELECTOR = { first: 'first', last: 'last' } as const;
export type LevelSelector = ValueOf<typeof LEVEL_SELECTOR>;

/** A moment of the round the balance names: the end of a round of the default length. */
export const ROUND_MOMENT = { defaultRoundEnd: 'default_round_end' } as const;
export type RoundMoment = ValueOf<typeof ROUND_MOMENT>;

export const FACT_FORMULA = {
  /** `radiusForMass(massOf(argument), balance.growth)`. */
  radiusAtMass: 'radius_at_mass',
  /** `maxSpeedForMass(massOf(argument), balance.growth)`. */
  maxSpeedAtMass: 'max_speed_at_mass',
  /** `levelUpCost(levelOf(argument), balance.progression)`. */
  levelUpCostAt: 'level_up_cost_at',
  /** `gelSpeedFactor(massOf(argument), balance.growth, the default gelSpeedFactorFloor)`. */
  gelSpeedFactorAt: 'gel_speed_factor_at',
  /** `worldReference(secondsOf(argument), balance).worldLevel`. */
  worldLevelAt: 'world_level_at',
  /** `worldReference(secondsOf(argument), balance).worldMass`. */
  worldMassAt: 'world_mass_at',
} as const;
export type FactFormulaId = ValueOf<typeof FACT_FORMULA>;

/** Each formula's argument: ids and closed selectors only, never a number. */
export interface FactFormulaArguments {
  [FACT_FORMULA.radiusAtMass]: { readonly mass: BalanceMass };
  [FACT_FORMULA.maxSpeedAtMass]: { readonly mass: BalanceMass };
  [FACT_FORMULA.levelUpCostAt]: { readonly level: LevelSelector };
  [FACT_FORMULA.gelSpeedFactorAt]: { readonly mass: BalanceMass };
  [FACT_FORMULA.worldLevelAt]: { readonly moment: RoundMoment };
  [FACT_FORMULA.worldMassAt]: { readonly moment: RoundMoment };
}

export type FactFormulaCall = {
  [Id in FactFormulaId]: { readonly id: Id; readonly argument: FactFormulaArguments[Id] };
}[FactFormulaId];

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

/** The round seconds elapsed at `moment`; the one moment so far is the whole default round. */
function secondsOf(balance: BalanceConfig, moment: RoundMoment): number {
  switch (moment) {
    case ROUND_MOMENT.defaultRoundEnd:
      return balance.session.ROUND_DURATION_SECONDS;
  }
}

export const FACT_FORMULAS: {
  readonly [Id in FactFormulaId]: (balance: BalanceConfig, argument: FactFormulaArguments[Id]) => number;
} = {
  [FACT_FORMULA.radiusAtMass]: (balance, argument) => radiusForMass(massOf(balance, argument.mass), balance.growth),
  [FACT_FORMULA.maxSpeedAtMass]: (balance, argument) => maxSpeedForMass(massOf(balance, argument.mass), balance.growth),
  [FACT_FORMULA.levelUpCostAt]: (balance, argument) =>
    levelUpCost(levelOf(balance, argument.level), balance.progression),
  [FACT_FORMULA.gelSpeedFactorAt]: (balance, argument) =>
    gelSpeedFactor(
      massOf(balance, argument.mass),
      balance.growth,
      balance.traits.DEFAULT_CELL_MODIFIERS.gelSpeedFactorFloor,
    ),
  [FACT_FORMULA.worldLevelAt]: (balance, argument) =>
    worldReference(secondsOf(balance, argument.moment), balance).worldLevel,
  [FACT_FORMULA.worldMassAt]: (balance, argument) =>
    worldReference(secondsOf(balance, argument.moment), balance).worldMass,
};

export function evaluateFormula(balance: BalanceConfig, call: FactFormulaCall): number {
  const formula = FACT_FORMULAS[call.id] as (balance: BalanceConfig, argument: FactFormulaCall['argument']) => number;
  return formula(balance, call.argument);
}
