// The one home of the engulf rules (docs/ecology/absorption.md §6.1): the mass ratio, the one predator-side test of
// the giant cells (docs/ecology/giants.md §3.5.6) that only the hunter eats cells, and the swallow switch
// (docs/game-design/early-life.md §15.5.1) that a player or plain wild cell swallows only from `SWALLOW_FROM_STAGE`
// on. Every caller that asks who can engulf
// whom asks `canEngulf` (the server's contact and engulf steps, the wild cells' flee, hunt and closer-rival rules, the
// bots, the HUD's danger chip and relations, the renderer's warning ring, the client's own-cell danger), so they can
// never disagree; only the server calls `canContinueEngulf`. Contact is the server's alone: these predicates warn about
// mass, not touch.

import type { BalanceConfig } from '../constants/balance.js';
import { GIANT_ROLE_BY_SPECIES } from '../constants/giants.js';
import { ENGULF_RELEASE_REASON, type EngulfReleaseReason } from '../types/effects.js';
import { GIANT_ROLE, type CellView, type GiantSpecies } from '../types/game.js';
import { ENGULF_PHASE, type EngulfPhase } from './engulf-pace.js';
import { hasReachedStage } from './stage-of.js';

/**
 * What `canEngulf` reads of a predator: its mass, its species (which decides whether it eats cells at all, and lets a
 * giant swallow at any stage) and its stage (which decides for a player or a plain wild cell).
 */
export type EngulfPredator = Pick<CellView, 'mass' | 'giantSpecies' | 'stage'>;
/** What the hold reads of a predator: its mass alone, since an engulf only ever started under `canEngulf`. */
export type EngulfHoldPredator = Pick<CellView, 'mass'>;
/** What the predicates read of a prey: its mass and the folded Cell Wall bonus carried on the view. */
export type EngulfPrey = Pick<CellView, 'mass' | 'membraneRatioBonus'>;
/** The two ratios and the swallow switch, taken from `balance.absorption`. */
export type EngulfRatioBalance = Pick<
  BalanceConfig['absorption'],
  'ENGULF_MASS_RATIO' | 'ENGULF_RELEASE_RATIO' | 'SWALLOW_FROM_STAGE'
>;

/** The least mass that meets `baseRatio` against `prey`: its mass × (`baseRatio` + its folded Cell Wall bonus). */
function requiredPredatorMass(prey: EngulfPrey, baseRatio: number): number {
  const requiredRatio = baseRatio + prey.membraneRatioBonus;
  return prey.mass * requiredRatio;
}

function meetsRatio(predator: EngulfHoldPredator, prey: EngulfPrey, baseRatio: number): boolean {
  return predator.mass >= requiredPredatorMass(prey, baseRatio);
}

/**
 * Whether a cell of this species eats cells (docs/ecology/giants.md §3.5.6): every player and plain wild cell (`null`)
 * and the giant hunter; the grazer and the drifter engulf no cell. Reads the fixed roles, never the balance.
 */
export function isCellEaterSpecies(species: GiantSpecies | null): boolean {
  return species === null || GIANT_ROLE_BY_SPECIES[species] === GIANT_ROLE.hunter;
}

/**
 * Whether a cell of this species and stage may swallow at all (docs/game-design/early-life.md §15.5.1): it eats cells,
 * and either its species decides (a giant hunter swallows at any stage) or its stage has reached `SWALLOW_FROM_STAGE`.
 */
function isSwallowingPredator(
  predator: Pick<EngulfPredator, 'giantSpecies' | 'stage'>,
  balance: Pick<EngulfRatioBalance, 'SWALLOW_FROM_STAGE'>,
): boolean {
  if (!isCellEaterSpecies(predator.giantSpecies)) return false;
  return predator.giantSpecies !== null || hasReachedStage(predator.stage, balance.SWALLOW_FROM_STAGE);
}

/**
 * The mass half of `canEngulf`: the predator weighs at least `ENGULF_MASS_RATIO + prey.membraneRatioBonus` times the
 * prey. What the HUD's "can't swallow yet" beat reads (early-life.md §15.9.1) instead of re-deriving the ratio.
 */
export function meetsEngulfStartRatio(
  predator: EngulfHoldPredator,
  prey: EngulfPrey,
  balance: Pick<EngulfRatioBalance, 'ENGULF_MASS_RATIO'>,
): boolean {
  return meetsRatio(predator, prey, balance.ENGULF_MASS_RATIO);
}

/**
 * `canStart`: the predator may swallow (its species, or its stage against the swallow switch) and meets the start
 * ratio. The giant hunter's hunt window gates its chase, never this (docs/ecology/giants.md §3.5.6).
 */
export function canEngulf(predator: EngulfPredator, prey: EngulfPrey, balance: EngulfRatioBalance): boolean {
  return isSwallowingPredator(predator, balance) && meetsEngulfStartRatio(predator, prey, balance);
}

/**
 * The least mass a cell that eats cells needs to start engulfing `prey`: `canEngulf`'s bound, as a figure. What the
 * encyclopedia quotes as the mass that swallows a giant (docs/ui/encyclopedia.md §11.4), so the page and the rule are one.
 */
export function engulfStartMass(prey: EngulfPrey, balance: Pick<EngulfRatioBalance, 'ENGULF_MASS_RATIO'>): number {
  return requiredPredatorMass(prey, balance.ENGULF_MASS_RATIO);
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
