// The one home of the engulf rules (docs/ecology/absorption.md §6.1): the mass ratio, the one predator-side test of
// the giant cells (docs/ecology/giants.md §3.5.6) and the pool's creatures that only the hunters eat cells, and the
// swallow switch (docs/game-design/early-life.md §15.5.1) that a player or plain wild cell swallows only by its traits
// (`canSwallowByTraits`, swallow-gate.ts). Every caller that asks who can engulf
// whom asks `canEngulf` (the server's contact and engulf steps, the wild cells' flee, hunt and closer-rival rules, the
// bots, the HUD's danger chip and relations, the renderer's warning ring, the client's own-cell danger), so they can
// never disagree; only the server calls `canContinueEngulf`. Contact is the server's alone: these predicates warn about
// mass, not touch.

import type { BalanceConfig } from '../constants/balance.js';
import { GIANT_ROLE_BY_SPECIES } from '../constants/giants.js';
import { ENGULF_RELEASE_REASON, type EngulfReleaseReason } from '../types/effects.js';
import { GIANT_ROLE, type CellView, type OwnedTrait } from '../types/game.js';
import { POOL_CREATURE_EATS_CELLS, type PoolCreatureView } from '../types/pool.js';
import { ENGULF_PHASE, type EngulfPhase } from './engulf-pace.js';
import { canSwallowByTraits } from './swallow-gate.js';

/** What `eatsCells` and `hasSpecies` read of a cell: its giant species and its pool creature's species. */
export interface CellSpeciesView {
  readonly giantSpecies: CellView['giantSpecies'];
  readonly poolCreature: Pick<PoolCreatureView, 'species'> | null;
}

/**
 * What `canEngulf` reads of a predator: its mass, its species (a giant's or a pool creature's, which decides whether it
 * eats cells at all and lets it swallow whatever it owns) and its owned traits (which decide for a player or a plain wild
 * cell). Read-only, so a `CellView`, a server record and a bot's view all satisfy it as they are.
 */
export interface EngulfPredator extends CellSpeciesView {
  readonly mass: number;
  readonly traits: readonly OwnedTrait[];
}
/** What the hold reads of a predator: its mass alone, since an engulf only ever started under `canEngulf`. */
export type EngulfHoldPredator = Pick<CellView, 'mass'>;
/** What the predicates read of a prey: its mass and the folded Cell Wall bonus carried on the view. */
export type EngulfPrey = Pick<CellView, 'mass' | 'membraneRatioBonus'>;
/** The two ratios and the swallow switch, taken from `balance.absorption`. */
export type EngulfRatioBalance = Pick<
  BalanceConfig['absorption'],
  'ENGULF_MASS_RATIO' | 'ENGULF_RELEASE_RATIO' | 'SWALLOW_GATE_TRAITS'
>;

/** The least mass that meets `baseRatio` against `prey`: its mass × (`baseRatio` + its folded Cell Wall bonus). */
function requiredPredatorMass(prey: EngulfPrey, baseRatio: number): number {
  const requiredRatio = baseRatio + prey.membraneRatioBonus;
  return prey.mass * requiredRatio;
}

function meetsRatio(predator: EngulfHoldPredator, prey: EngulfPrey, baseRatio: number): boolean {
  return predator.mass >= requiredPredatorMass(prey, baseRatio);
}

/** Whether a cell has a species that decides for it (early-life.md §15.5.1): a giant, or a pool creature. */
export function hasSpecies(cell: CellSpeciesView): boolean {
  return cell.giantSpecies !== null || cell.poolCreature !== null;
}

/**
 * Whether a cell eats cells at all (docs/ecology/giants.md §3.5.6, docs/game-design/early-life.md §15.5.1): a giant by
 * its role (the hunter only; the grazer and the drifter engulf no cell), a pool creature by its species (the Didinium
 * and the rotifer; never the nematode), and every other cell, a player or a plain wild cell. Reads fixed species facts,
 * never the balance.
 */
export function eatsCells(cell: CellSpeciesView): boolean {
  if (cell.giantSpecies !== null) return GIANT_ROLE_BY_SPECIES[cell.giantSpecies] === GIANT_ROLE.hunter;
  if (cell.poolCreature !== null) return POOL_CREATURE_EATS_CELLS[cell.poolCreature.species];
  return true;
}

/**
 * Whether a cell may swallow at all (docs/game-design/early-life.md §15.5.1): it eats cells, and either its species
 * decides (a giant hunter or an eating creature swallows whatever it owns) or it may swallow by its traits.
 */
function isSwallowingPredator(
  predator: Omit<EngulfPredator, 'mass'>,
  balance: Pick<EngulfRatioBalance, 'SWALLOW_GATE_TRAITS'>,
): boolean {
  if (!eatsCells(predator)) return false;
  return hasSpecies(predator) || canSwallowByTraits(predator.traits, balance);
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
 * `canStart`: the predator may swallow (its species, or its traits against the swallow switch) and meets the start
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
