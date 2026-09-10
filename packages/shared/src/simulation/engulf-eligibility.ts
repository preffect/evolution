// The one home of the engulf mass-ratio rules (docs/ECOLOGY.md §6.1). Three callers share
// `canEngulf` (the server engulf system, the HUD danger chip, the renderer's warning ring) so
// they can never disagree about who can engulf whom; only the server calls `canContinueEngulf`.
// Contact is the server's alone: these predicates warn about mass, not touch.

import type { CellView } from '../types/game.js';
import type { BalanceConfig } from '../constants/balance.js';

/** What the predicates read of a predator: its mass. */
export type EngulfPredator = Pick<CellView, 'mass'>;
/** What the predicates read of a prey: its mass and the folded Cell Wall bonus carried on the view. */
export type EngulfPrey = Pick<CellView, 'mass' | 'membraneRatioBonus'>;
/** The two ratios, taken from `balance.absorption`. */
export type EngulfRatioBalance = Pick<BalanceConfig['absorption'], 'ENGULF_MASS_RATIO' | 'ENGULF_RELEASE_RATIO'>;

function meetsRatio(predator: EngulfPredator, prey: EngulfPrey, baseRatio: number): boolean {
  const requiredRatio = baseRatio + prey.membraneRatioBonus;
  return predator.mass >= prey.mass * requiredRatio;
}

/** `canStart`: the predator weighs at least `ENGULF_MASS_RATIO + prey.membraneRatioBonus` times the prey. */
export function canEngulf(predator: EngulfPredator, prey: EngulfPrey, balance: EngulfRatioBalance): boolean {
  return meetsRatio(predator, prey, balance.ENGULF_MASS_RATIO);
}

/** `canContinue`: an engulf in progress holds down to `ENGULF_RELEASE_RATIO + prey.membraneRatioBonus` (hysteresis). */
export function canContinueEngulf(predator: EngulfPredator, prey: EngulfPrey, balance: EngulfRatioBalance): boolean {
  return meetsRatio(predator, prey, balance.ENGULF_RELEASE_RATIO);
}
