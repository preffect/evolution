// What the engulf trait rows share (docs/traits/constants-and-acceptance.md §6: T3, T4, T6, T13–T19, T21, T22): the
// predator's mass under decay plus the contact drain and the swallowed dose, tick for tick as the metabolism
// step takes them (docs/ecology/mass-and-movement.md §4.1), and a step model of an idle held pair that derives
// a whole engulf's outcome from the same shared formulas the engulf step runs (docs/ecology/absorption.md §6.1).
// Not a test file: the trait scenario and integration files import it.

import {
  DEFAULT_BALANCE,
  ENGULF_PHASE,
  TICK_INTERVAL_S,
  canContinueEngulf,
  canEngulf,
  engulfPhaseOf,
  engulfProgressDelta,
  type CellModifiers,
} from '@evolution/shared';
import { engulfMassYieldOf } from '../../game/simulation/engulf-payout.js';

const { growth, ecology, absorption } = DEFAULT_BALANCE;
/** An idle held pair: the prey never steers away. */
const NO_AWAY_EFFORT = 0;

/** The prey a dose is read against (#154): its start-of-span mass, decaying in the broth, and its fraction. */
export interface PreyDose {
  readonly preyMass: number;
  readonly fractionPerSecond: number;
}

/** A run of ticks at one contact drain (a share of the cell's own mass) and one prey-set dose. */
export interface DrainSpan {
  readonly ticks: number;
  readonly contactFractionPerSecond?: number;
  readonly dose?: PreyDose;
}

/** One tick of broth metabolism on `mass`: surplus decay (× the cell's own multiplier) plus a drain, floored. */
function afterOneTick(mass: number, drainMassPerSecond: number, decayMultiplier = 1): number {
  const decay = Math.max(0, mass - growth.CELL_STARTING_MASS) * ecology.MASS_DECAY_RATE_PER_SECOND * decayMultiplier;
  return Math.max(growth.CELL_STARTING_MASS, mass - (decay + drainMassPerSecond) * TICK_INTERVAL_S);
}

/**
 * The mass after `spans` of broth metabolism: each tick removes the decay of the surplus, the contact drain of
 * the whole start-of-tick mass and the dose on the prey's start-of-tick mass, which decays as it goes.
 */
export function drainedMass(mass: number, spans: readonly DrainSpan[]): number {
  let current = mass;
  for (const span of spans) {
    let preyMass = span.dose?.preyMass ?? 0;
    for (let tick = 0; tick < span.ticks; tick += 1) {
      const dose = preyMass * (span.dose?.fractionPerSecond ?? 0);
      current = afterOneTick(current, current * (span.contactFractionPerSecond ?? 0) + dose);
      preyMass = afterOneTick(preyMass, 0);
    }
  }
  return current;
}

/** An idle pair placed in contact in the broth, with each side's folded modifiers; the prey never spits out. */
export interface HeldPairModelInput {
  readonly predatorMass: number;
  readonly preyMass: number;
  readonly predator: CellModifiers;
  readonly prey: CellModifiers;
  readonly maxTicks: number;
}

export const HELD_PAIR_OUTCOME = { payout: 'payout', ratio: 'ratio', unfinished: 'unfinished' } as const;

export interface HeldPairOutcome {
  readonly kind: (typeof HELD_PAIR_OUTCOME)[keyof typeof HELD_PAIR_OUTCOME];
  readonly tick: number;
  /** After the yield on a payout; the drained mass on a release. */
  readonly predatorMass: number;
}

interface HeldPairState {
  predatorMass: number;
  preyMass: number;
  /** `null` until the engulf starts. */
  progress: number | null;
}

/**
 * Step 5 for the pair: contact toxin until the engulf is past cover, then the swallowed dose, plus the spikes.
 * This mirrors `metabolise` / `engulfDrainOf` (docs/ecology/mass-and-movement.md §4.1) rather than calling them, on
 * purpose: the rows compare the simulation against this model, and a model that called the step would be
 * comparing the simulation with itself. The rules it must not copy — eligibility and pace — are the shared
 * functions below, and the design row's own numbers guard the pair of them drifting together (T22).
 */
function metabolisePair(state: HeldPairState, input: HeldPairModelInput): void {
  const { prey } = input;
  const isPastCover = state.progress !== null && engulfPhaseOf(state.progress, absorption) !== ENGULF_PHASE.cover;
  const contactFraction = isPastCover ? 0 : prey.toxinDrainFractionPerSecond;
  const swallowedDose = isPastCover
    ? state.preyMass * prey.toxinDrainFractionPerSecond * absorption.ENGULF_SWALLOWED_TOXIN_MULTIPLIER
    : 0;
  const spikeDose =
    state.progress !== null && state.progress > 0 ? state.preyMass * prey.spikeDrainFractionPerSecond : 0;
  const drain = state.predatorMass * contactFraction + swallowedDose + spikeDose;
  state.predatorMass = afterOneTick(state.predatorMass, drain, input.predator.decayMultiplier);
  state.preyMass = afterOneTick(state.preyMass, 0, prey.decayMultiplier);
}

/**
 * The outcome of an idle held pair (docs/ecology/absorption.md §6.1, order per tick: metabolism, start, ratio,
 * progress, payout), from the shared eligibility and pace formulas the engulf step itself calls.
 */
export function modelHeldPair(input: HeldPairModelInput): HeldPairOutcome {
  const state: HeldPairState = { predatorMass: input.predatorMass, preyMass: input.preyMass, progress: null };
  for (let tick = 1; tick <= input.maxTicks; tick += 1) {
    metabolisePair(state, input);
    const predatorView = { mass: state.predatorMass };
    const preyView = { mass: state.preyMass, membraneRatioBonus: input.prey.membraneRatioBonus };
    if (state.progress === null) {
      if (!canEngulf(predatorView, preyView, absorption)) continue;
      state.progress = 0;
    }
    if (!canContinueEngulf(predatorView, preyView, absorption)) {
      return { kind: HELD_PAIR_OUTCOME.ratio, tick, predatorMass: state.predatorMass };
    }
    state.progress += engulfProgressDelta(
      {
        phase: engulfPhaseOf(state.progress, absorption),
        predatorMass: state.predatorMass,
        preyMass: state.preyMass,
        isInContact: true,
        awayEffort: NO_AWAY_EFFORT,
        predator: input.predator,
        prey: input.prey,
      },
      absorption,
    );
    if (state.progress >= 1 - absorption.ENGULF_PROGRESS_EPSILON) {
      const yieldShare = engulfMassYieldOf(input.predator, DEFAULT_BALANCE);
      return { kind: HELD_PAIR_OUTCOME.payout, tick, predatorMass: state.predatorMass + state.preyMass * yieldShare };
    }
  }
  return { kind: HELD_PAIR_OUTCOME.unfinished, tick: input.maxTicks, predatorMass: state.predatorMass };
}
