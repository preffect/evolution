// The engulf pace formulas (docs/ECOLOGY.md §6.1): numbers in, numbers out, no state and no
// randomness (docs/ARCHITECTURE.md §3.1). Shared because the HUD's escape arc and the renderer's
// membrane read `engulfPhaseOf` on the same thresholds the server advances progress with
// (docs/UI.md §3.1, docs/VISUAL-STYLE.md §5); everything that needs more than a phase is the
// server's alone. The ratio predicates live next door in `engulf-eligibility.ts`.

import type { BalanceConfig } from '../constants/balance.js';
import { TICK_INTERVAL_S } from '../constants/network.js';
import { clamp, type ValueOf } from '../types/common.js';

/** The three phases of an engulf; the phase is a band of `engulfProgress`, never stored. */
export const ENGULF_PHASE = { cover: 'cover', wrap: 'wrap', absorb: 'absorb' } as const;
export type EngulfPhase = ValueOf<typeof ENGULF_PHASE>;

/** The `balance.absorption` rows the pace reads; the room's live copy, so `debug_set_balance` is felt. */
export type EngulfPaceBalance = Pick<
  BalanceConfig['absorption'],
  | 'ENGULF_MASS_RATIO'
  | 'ENGULF_PROGRESS_EPSILON'
  | 'ENGULF_BASE_DURATION_SECONDS'
  | 'ENGULF_WRAP_START_PROGRESS'
  | 'ENGULF_SEAL_PROGRESS'
  | 'ENGULF_MIN_DURATION_FACTOR'
  | 'ENGULF_ESCAPE_DECAY_MULTIPLIER'
  | 'ENGULF_STRUGGLE_SLOWDOWN'
  | 'ENGULF_STRUGGLE_SLOWDOWN_CAP'
  | 'ENGULF_PREDATOR_SPEED_FACTOR'
  | 'ENGULF_PREDATOR_SPEED_FACTOR_SEALED'
  | 'ENGULF_PREY_SPEED_FACTOR'
  | 'ENGULF_PREY_SPEED_FACTOR_FLOOR'
>;

/**
 * The predator's half of the pace modifiers (docs/TRAITS.md §2). Declared here with the names
 * `CellModifiers` will carry once #260 splits `engulfDurationMultiplierAsPredator`, so the engulf
 * step never learns a trait id and #260 changes one adapter instead of every call site.
 */
export interface EngulfPredatorPaceModifiers {
  readonly wrapDurationMultiplierAsPredator: number;
  readonly absorbDurationMultiplierAsPredator: number;
  readonly gripStrengthBonus: number;
}

/** The prey's half of the same set (docs/TRAITS.md §2, #260). */
export interface EngulfPreyPaceModifiers {
  readonly absorbDurationMultiplierAsPrey: number;
  readonly gripResistanceBonus: number;
  readonly struggleSlowdownBonus: number;
  readonly spitOutChancePerSecond: number;
}

/** What one tick of progress depends on (docs/ECOLOGY.md §6.1, "The process"). */
export interface EngulfProgressInput {
  readonly phase: EngulfPhase;
  readonly predatorMass: number;
  readonly preyMass: number;
  readonly isInContact: boolean;
  /** 0..1: the prey's steer command of this tick projected away from the predator. */
  readonly awayEffort: number;
  readonly predator: EngulfPredatorPaceModifiers;
  readonly prey: EngulfPreyPaceModifiers;
}

/** The phase band `progress` falls in; `ENGULF_PROGRESS_EPSILON` keeps a boundary tick on the far side. */
export function engulfPhaseOf(progress: number, balance: EngulfPaceBalance): EngulfPhase {
  if (progress >= balance.ENGULF_SEAL_PROGRESS - balance.ENGULF_PROGRESS_EPSILON) {
    return ENGULF_PHASE.absorb;
  }
  if (progress >= balance.ENGULF_WRAP_START_PROGRESS - balance.ENGULF_PROGRESS_EPSILON) {
    return ENGULF_PHASE.wrap;
  }
  return ENGULF_PHASE.cover;
}

/** `clamp(ENGULF_MASS_RATIO / (predator.mass / prey.mass), ENGULF_MIN_DURATION_FACTOR, 1)`: a heavier predator is faster. */
export function engulfMassFactor(predatorMass: number, preyMass: number, balance: EngulfPaceBalance): number {
  const massRatio = predatorMass / preyMass;
  return clamp(balance.ENGULF_MASS_RATIO / massRatio, balance.ENGULF_MIN_DURATION_FACTOR, FULL_DURATION_FACTOR);
}

/** Progress per tick before the phase multiplier and the struggle: `TICK_INTERVAL_S / (base × massFactor)`. */
export function engulfBaseRatePerTick(predatorMass: number, preyMass: number, balance: EngulfPaceBalance): number {
  const massFactor = engulfMassFactor(predatorMass, preyMass, balance);
  return TICK_INTERVAL_S / (balance.ENGULF_BASE_DURATION_SECONDS * massFactor);
}

/** A prey that is not steering away loses none of the phase rate. */
const NO_SLOWDOWN = 1;
/** A predator at exactly `ENGULF_MASS_RATIO` takes the full base duration; heavier ones go faster, never slower. */
const FULL_DURATION_FACTOR = 1;
/** Cover has no trait multiplier of its own: nothing in docs/TRAITS.md §2 touches it. */
const COVER_PHASE_MULTIPLIER = 1;
/** The prey is not held yet during cover, and is carried (speed cap 0) once sealed. */
const PREY_UNHELD_SPEED_FACTOR = 1;
const PREY_CARRIED_SPEED_FACTOR = 0;
/** The highest a grip may be resisted to: a held prey never outruns its own cap. */
const PREY_HELD_SPEED_FACTOR_CEILING = 1;

/** The phase's duration multiplier: 1 in cover, the predator's wrap in wrap, both sides' absorb in absorb. */
export function engulfPhaseMultiplier(
  phase: EngulfPhase,
  predator: EngulfPredatorPaceModifiers,
  prey: EngulfPreyPaceModifiers,
): number {
  switch (phase) {
    case ENGULF_PHASE.cover:
      return COVER_PHASE_MULTIPLIER;
    case ENGULF_PHASE.wrap:
      return predator.wrapDurationMultiplierAsPredator;
    case ENGULF_PHASE.absorb:
      return prey.absorbDurationMultiplierAsPrey * predator.absorbDurationMultiplierAsPredator;
  }
}

/**
 * The struggle (cover and wrap): `min(cap, ENGULF_STRUGGLE_SLOWDOWN + bonus) × awayEffort`, the
 * share of this tick's phase rate the prey's steering away takes off.
 */
export function engulfStruggleSlowdown(
  awayEffort: number,
  struggleSlowdownBonus: number,
  balance: EngulfPaceBalance,
): number {
  const perEffort = Math.min(
    balance.ENGULF_STRUGGLE_SLOWDOWN_CAP,
    balance.ENGULF_STRUGGLE_SLOWDOWN + struggleSlowdownBonus,
  );
  return perEffort * awayEffort;
}

/**
 * This tick's signed progress change (docs/ECOLOGY.md §6.1, step 5): the phase rate slowed by the
 * struggle while in contact, the escape decay while a wrap has lost contact, and zero for a cover
 * that has lost contact (the caller releases it instead of decaying anything).
 */
export function engulfProgressDelta(input: EngulfProgressInput, balance: EngulfPaceBalance): number {
  const baseRatePerTick = engulfBaseRatePerTick(input.predatorMass, input.preyMass, balance);
  if (!input.isInContact && input.phase !== ENGULF_PHASE.absorb) {
    return input.phase === ENGULF_PHASE.wrap ? -balance.ENGULF_ESCAPE_DECAY_MULTIPLIER * baseRatePerTick : 0;
  }
  const phaseRatePerTick = baseRatePerTick / engulfPhaseMultiplier(input.phase, input.predator, input.prey);
  if (input.phase === ENGULF_PHASE.absorb) {
    return phaseRatePerTick;
  }
  return (
    phaseRatePerTick *
    (NO_SLOWDOWN - engulfStruggleSlowdown(input.awayEffort, input.prey.struggleSlowdownBonus, balance))
  );
}

/** The prey's speed cap factor: 1 in cover, the grip in wrap, 0 once sealed (it is carried). */
export function preyHeldSpeedFactor(
  phase: EngulfPhase,
  predatorGripStrengthBonus: number,
  preyGripResistanceBonus: number,
  balance: EngulfPaceBalance,
): number {
  switch (phase) {
    case ENGULF_PHASE.cover:
      return PREY_UNHELD_SPEED_FACTOR;
    case ENGULF_PHASE.wrap:
      return clamp(
        balance.ENGULF_PREY_SPEED_FACTOR - predatorGripStrengthBonus + preyGripResistanceBonus,
        balance.ENGULF_PREY_SPEED_FACTOR_FLOOR,
        PREY_HELD_SPEED_FACTOR_CEILING,
      );
    case ENGULF_PHASE.absorb:
      return PREY_CARRIED_SPEED_FACTOR;
  }
}

/** The predator's speed cap factor: slowed while it is still wrapping, unhindered once sealed. */
export function predatorEngulfSpeedFactor(phase: EngulfPhase, balance: EngulfPaceBalance): number {
  return phase === ENGULF_PHASE.absorb
    ? balance.ENGULF_PREDATOR_SPEED_FACTOR_SEALED
    : balance.ENGULF_PREDATOR_SPEED_FACTOR;
}

/** The per-tick spit-out probability of a prey whose spines roll every tick (docs/ECOLOGY.md §6.1). */
export function spitOutChancePerTick(preySpitOutChancePerSecond: number): number {
  return preySpitOutChancePerSecond * TICK_INTERVAL_S;
}
