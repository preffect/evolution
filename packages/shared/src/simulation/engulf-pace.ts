// The engulf pace formulas (docs/ecology/absorption.md §6.1): numbers in, numbers out, no state and no
// randomness (docs/architecture/server-simulation.md §3.1). Shared because the HUD's escape arc and the renderer's
// membrane read `engulfPhaseOf` on the same thresholds the server advances progress with
// (docs/ui/hud.md §3.1, docs/visual-style/motion-and-legibility.md §5); everything that needs more than a phase is the
// server's alone. The ratio predicates live next door in `engulf-eligibility.ts`.

import type { BalanceConfig } from '../constants/balance.js';
import { TICK_INTERVAL_S } from '../constants/network.js';
import { clamp, type ValueOf } from '../types/common.js';
import type { CellModifiers } from '../types/traits.js';

/** The three phases of an engulf; the phase is a band of `engulfProgress`, never stored. */
export const ENGULF_PHASE = { cover: 'cover', wrap: 'wrap', absorb: 'absorb' } as const;
export type EngulfPhase = ValueOf<typeof ENGULF_PHASE>;

/** The three phase seconds (docs/ecology/constants.md §7): the engulf's tunables, everything else is derived. */
type EngulfPhaseSecondsKey = 'ENGULF_COVER_SECONDS' | 'ENGULF_WRAP_SECONDS' | 'ENGULF_ABSORB_SECONDS';
export type EngulfPhaseSeconds = Readonly<Record<EngulfPhaseSecondsKey, number>>;

/** The `balance.absorption` rows the pace reads; the room's live copy, so `debug_set_balance` is felt. */
export type EngulfPaceBalance = Pick<
  BalanceConfig['absorption'],
  | 'ENGULF_MASS_RATIO'
  | 'ENGULF_PROGRESS_EPSILON'
  | EngulfPhaseSecondsKey
  | 'ENGULF_MIN_DURATION_FACTOR'
  | 'ENGULF_ESCAPE_DECAY_MULTIPLIER'
  | 'ENGULF_STRUGGLE_SLOWDOWN'
  | 'ENGULF_STRUGGLE_SLOWDOWN_CAP'
  | 'ENGULF_PREDATOR_SPEED_FACTOR'
  | 'ENGULF_PREDATOR_SPEED_FACTOR_SEALED'
  | 'ENGULF_PREY_SPEED_FACTOR_COVER'
  | 'ENGULF_PREY_SPEED_FACTOR'
  | 'ENGULF_PREY_SPEED_FACTOR_FLOOR'
>;

/**
 * The pace terms of the predator's folded modifiers (docs/ecology/absorption.md §6.1, docs/traits/model.md §2). Only
 * what the rate reads: the grip belongs to `preyHeldSpeedFactor`, which takes it as a number.
 */
export type EngulfPredatorPaceModifiers = Pick<
  CellModifiers,
  'wrapDurationMultiplierAsPredator' | 'absorbDurationMultiplierAsPredator'
>;

/** The pace terms of the prey's folded modifiers; the spit-out chance is read by the engulf step itself. */
export type EngulfPreyPaceModifiers = Pick<CellModifiers, 'absorbDurationMultiplierAsPrey' | 'struggleSlowdownBonus'>;

/** What one tick of progress depends on (docs/ecology/absorption.md §6.1, "The process"). */
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

/**
 * Duration at exactly the required ratio (s): the three phase seconds summed at read time, so a patched phase second
 * is felt (#367). Summed absorb-first so the default is exactly the documented 1.2 (cover-first gives
 * 1.2000000000000002).
 */
export function engulfBaseDurationSeconds(balance: EngulfPhaseSeconds): number {
  return balance.ENGULF_ABSORB_SECONDS + balance.ENGULF_WRAP_SECONDS + balance.ENGULF_COVER_SECONDS;
}

/** The progress at which wrap starts: the cover's share of the base duration (1/6 by default). */
export function engulfWrapStartProgress(balance: EngulfPhaseSeconds): number {
  return balance.ENGULF_COVER_SECONDS / engulfBaseDurationSeconds(balance);
}

/** The progress at which the seal closes: cover and wrap's share of the base duration (exactly 0.5 by default). */
export function engulfSealProgress(balance: EngulfPhaseSeconds): number {
  const baseDurationSeconds = engulfBaseDurationSeconds(balance);
  return (baseDurationSeconds - balance.ENGULF_ABSORB_SECONDS) / baseDurationSeconds;
}

/** The phase band `progress` falls in; `ENGULF_PROGRESS_EPSILON` keeps a boundary tick on the far side. */
export function engulfPhaseOf(progress: number, balance: EngulfPaceBalance): EngulfPhase {
  if (progress >= engulfSealProgress(balance) - balance.ENGULF_PROGRESS_EPSILON) {
    return ENGULF_PHASE.absorb;
  }
  if (progress >= engulfWrapStartProgress(balance) - balance.ENGULF_PROGRESS_EPSILON) {
    return ENGULF_PHASE.wrap;
  }
  return ENGULF_PHASE.cover;
}

/** Progress runs from here to `COMPLETE_PROGRESS`; the absorb band ends where the payout fires. */
const START_PROGRESS = 0;
const COMPLETE_PROGRESS = 1;

/**
 * How long a phase lasts at exactly the required ratio, with nobody fighting: the base duration × the width of the
 * phase's progress band — cover `[0, wrapStart)`, wrap `[wrapStart, seal)`, absorb `[seal, 1]`
 * (docs/architecture/encyclopedia.md §12.3, ticket #362). The three spans sum to the base duration, and each is its
 * phase second up to float rounding. The encyclopedia's facts and preview scenes read this, so a patched
 * `ENGULF_WRAP_SECONDS` moves the shown spans exactly as it moves the engulf (#367).
 */
export function engulfPhaseSpanSeconds(phase: EngulfPhase, balance: EngulfPaceBalance): number {
  return engulfBaseDurationSeconds(balance) * engulfPhaseBandWidth(phase, balance);
}

function engulfPhaseBandWidth(phase: EngulfPhase, balance: EngulfPaceBalance): number {
  switch (phase) {
    case ENGULF_PHASE.cover:
      return engulfWrapStartProgress(balance) - START_PROGRESS;
    case ENGULF_PHASE.wrap:
      return engulfSealProgress(balance) - engulfWrapStartProgress(balance);
    case ENGULF_PHASE.absorb:
      return COMPLETE_PROGRESS - engulfSealProgress(balance);
  }
}

/** `clamp(ENGULF_MASS_RATIO / (predator.mass / prey.mass), ENGULF_MIN_DURATION_FACTOR, 1)`: a heavier predator is faster. */
export function engulfMassFactor(predatorMass: number, preyMass: number, balance: EngulfPaceBalance): number {
  const massRatio = predatorMass / preyMass;
  return clamp(balance.ENGULF_MASS_RATIO / massRatio, balance.ENGULF_MIN_DURATION_FACTOR, FULL_DURATION_FACTOR);
}

/** Progress per tick before the phase multiplier and the struggle: `TICK_INTERVAL_S / (base × massFactor)`. */
export function engulfBaseRatePerTick(predatorMass: number, preyMass: number, balance: EngulfPaceBalance): number {
  const massFactor = engulfMassFactor(predatorMass, preyMass, balance);
  return TICK_INTERVAL_S / (engulfBaseDurationSeconds(balance) * massFactor);
}

/** A prey that is not steering away loses none of the phase rate. */
const NO_SLOWDOWN = 1;
/** A predator at exactly `ENGULF_MASS_RATIO` takes the full base duration; heavier ones go faster, never slower. */
const FULL_DURATION_FACTOR = 1;
/** Cover has no trait multiplier of its own: nothing in docs/traits/model.md §2 touches it. */
const COVER_PHASE_MULTIPLIER = 1;
/** The prey is carried (speed cap 0) once sealed. */
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
 * This tick's signed progress change (docs/ecology/absorption.md §6.1, step 5): the phase rate slowed by the
 * struggle while in contact, and the escape decay while a cover or a wrap has lost contact (the caller releases the
 * prey once it has drained to 0).
 */
export function engulfProgressDelta(input: EngulfProgressInput, balance: EngulfPaceBalance): number {
  const baseRatePerTick = engulfBaseRatePerTick(input.predatorMass, input.preyMass, balance);
  if (!input.isInContact && input.phase !== ENGULF_PHASE.absorb) {
    return -balance.ENGULF_ESCAPE_DECAY_MULTIPLIER * baseRatePerTick;
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

/**
 * The prey's speed cap factor: the mild grab in cover, the grip in wrap — each moved by the predator's grip and the
 * prey's resistance (Amoeba grips, Cilia slip) — and 0 once sealed (it is carried).
 */
export function preyHeldSpeedFactor(
  phase: EngulfPhase,
  predatorGripStrengthBonus: number,
  preyGripResistanceBonus: number,
  balance: EngulfPaceBalance,
): number {
  if (phase === ENGULF_PHASE.absorb) {
    return PREY_CARRIED_SPEED_FACTOR;
  }
  const heldFactor =
    phase === ENGULF_PHASE.cover ? balance.ENGULF_PREY_SPEED_FACTOR_COVER : balance.ENGULF_PREY_SPEED_FACTOR;
  return clamp(
    heldFactor - predatorGripStrengthBonus + preyGripResistanceBonus,
    balance.ENGULF_PREY_SPEED_FACTOR_FLOOR,
    PREY_HELD_SPEED_FACTOR_CEILING,
  );
}

/** The predator's speed cap factor: slowed while it is still wrapping, unhindered once sealed. */
export function predatorEngulfSpeedFactor(phase: EngulfPhase, balance: EngulfPaceBalance): number {
  return phase === ENGULF_PHASE.absorb
    ? balance.ENGULF_PREDATOR_SPEED_FACTOR_SEALED
    : balance.ENGULF_PREDATOR_SPEED_FACTOR;
}

/** The per-tick spit-out probability of a prey whose spines roll every tick (docs/ecology/absorption.md §6.1). */
export function spitOutChancePerTick(preySpitOutChancePerSecond: number): number {
  return preySpitOutChancePerSecond * TICK_INTERVAL_S;
}
