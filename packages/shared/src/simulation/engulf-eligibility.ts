// The one home of the engulf rules (docs/ecology/absorption.md §6.1): the mass ratio, and the one predator-side test of
// the giant cells (docs/ecology/giants.md §3.5.6) that only the hunter eats cells. Every caller that asks who can engulf
// whom asks `canEngulf` (the server's contact and engulf steps, the wild cells' flee, hunt and closer-rival rules, the
// bots, the HUD's danger chip and relations, the renderer's warning ring, the client's own-cell danger), so they can
// never disagree; only the server calls `canContinueEngulf`. Contact is the server's alone: these predicates warn about
// mass, not touch.

import type { BalanceConfig } from '../constants/balance.js';
import { GIANT_ROLE_BY_SPECIES } from '../constants/giants.js';
import { ENGULF_RELEASE_REASON, type EngulfReleaseReason } from '../types/effects.js';
import { GIANT_ROLE, type CellView, type GiantSpecies } from '../types/game.js';
import { ENGULF_PHASE, type EngulfPhase } from './engulf-pace.js';

/** What `canEngulf` reads of a predator: its mass and its species, which decides whether it eats cells at all. */
export type EngulfPredator = Pick<CellView, 'mass' | 'giantSpecies'>;
/** What the hold reads of a predator: its mass alone, since an engulf only ever started under `canEngulf`. */
export type EngulfHoldPredator = Pick<CellView, 'mass'>;
/** What the predicates read of a prey: its mass and the folded Cell Wall bonus carried on the view. */
export type EngulfPrey = Pick<CellView, 'mass' | 'membraneRatioBonus'>;
/** The two ratios, taken from `balance.absorption`. */
export type EngulfRatioBalance = Pick<BalanceConfig['absorption'], 'ENGULF_MASS_RATIO' | 'ENGULF_RELEASE_RATIO'>;

function meetsRatio(predator: EngulfHoldPredator, prey: EngulfPrey, baseRatio: number): boolean {
  const requiredRatio = baseRatio + prey.membraneRatioBonus;
  return predator.mass >= prey.mass * requiredRatio;
}

/**
 * Whether a cell of this species eats cells (docs/ecology/giants.md §3.5.6): every player and plain wild cell (`null`)
 * and the giant hunter; the grazer and the drifter engulf no cell. Reads the fixed roles, never the balance.
 */
export function isCellEaterSpecies(species: GiantSpecies | null): boolean {
  return species === null || GIANT_ROLE_BY_SPECIES[species] === GIANT_ROLE.hunter;
}

/**
 * `canStart`: the predator eats cells and weighs at least `ENGULF_MASS_RATIO + prey.membraneRatioBonus` times the prey.
 * The giant hunter's hunt window gates its chase, never this (docs/ecology/giants.md §3.5.6).
 */
export function canEngulf(predator: EngulfPredator, prey: EngulfPrey, balance: EngulfRatioBalance): boolean {
  return isCellEaterSpecies(predator.giantSpecies) && meetsRatio(predator, prey, balance.ENGULF_MASS_RATIO);
}

/** `canContinue`: an engulf in progress holds down to `ENGULF_RELEASE_RATIO + prey.membraneRatioBonus` (hysteresis). */
export function canContinueEngulf(
  predator: EngulfHoldPredator,
  prey: EngulfPrey,
  balance: EngulfRatioBalance,
): boolean {
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
 * The hold verdict of docs/ecology/absorption.md §6.1 steps 2 and 4, in that order: the ratio first (it
 * releases in any phase, seal included), then the spit-out, which only a wrapped or sealed prey
 * rolls. Server-only: the HUD warns about mass, never about a roll.
 */
export function resolveEngulfHold(
  predator: EngulfHoldPredator,
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
