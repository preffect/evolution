// The one home of the engulf mass-ratio rules (docs/ECOLOGY.md §6.1). Three callers share
// `canEngulf` (the server engulf system, the HUD danger chip, the renderer's warning ring) so
// they can never disagree about who can engulf whom; only the server calls `canContinueEngulf`.
// Contact is the server's alone: these predicates warn about mass, not touch.

import type { BalanceConfig } from '../constants/balance.js';
import { ENGULF_RELEASE_REASON, type EngulfReleaseReason } from '../types/effects.js';
import type { CellView } from '../types/game.js';
import { ENGULF_PHASE, type EngulfPhase } from './engulf-pace.js';

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

/** A hold that survived this tick's checks; the caller advances progress instead of releasing. */
export const ENGULF_HOLD = 'hold';

/** What one tick's hold check decides: keep holding, or release for one of the two hold reasons. */
export type EngulfHoldVerdict = typeof ENGULF_HOLD | Extract<EngulfReleaseReason, 'ratio' | 'spat_out'>;

/** This tick's spit-out draw: `spitOutRoll` is null when the prey's chance is 0 and no draw was made. */
export interface EngulfSpitOutDraw {
  readonly phase: EngulfPhase;
  readonly spitOutRoll: number | null;
  readonly spitOutChancePerTick: number;
}

/**
 * The hold verdict of docs/ECOLOGY.md §6.1 steps 2 and 4, in that order: the ratio first (it
 * releases in any phase, seal included), then the spit-out, which only a wrapped or sealed prey
 * rolls. Server-only: the HUD warns about mass, never about a roll.
 */
export function resolveEngulfHold(
  predator: EngulfPredator,
  prey: EngulfPrey,
  draw: EngulfSpitOutDraw,
  balance: EngulfRatioBalance,
): EngulfHoldVerdict {
  if (!canContinueEngulf(predator, prey, balance)) {
    return ENGULF_RELEASE_REASON.ratio;
  }
  if (draw.phase !== ENGULF_PHASE.cover && draw.spitOutRoll !== null && draw.spitOutRoll < draw.spitOutChancePerTick) {
    return ENGULF_RELEASE_REASON.spatOut;
  }
  return ENGULF_HOLD;
}
