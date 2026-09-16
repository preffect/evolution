// The mass chip's trend (docs/ui/hud.md §3.1.5): the own cell's net mass rate over the last
// `MASS_TREND_WINDOW_SECONDS`, and whether it reads up, down or steady. The rate is the server's own numbers — the
// metabolism's applied `ratesPerSecond` plus the one-off amounts of this window (the own `eat` gains, the own
// engulf payouts, a sprint's cost) spread over the window — never a difference of 0.1-quantised masses. Pure: the
// memory is carried from snapshot to snapshot by the caller (`GameStateService`).

import {
  EFFECT_KIND,
  secondsToTicks,
  type EntityId,
  type GameEffect,
  type MassFlowView,
  type ValueOf,
} from '@evolution/shared';
import {
  MASS_TREND_ENTER_PER_SECOND,
  MASS_TREND_EXIT_PER_SECOND,
  MASS_TREND_WINDOW_SECONDS,
} from './legibility-constants';

export const MASS_TREND = { up: 'up', down: 'down', steady: 'steady' } as const;
export type MassTrend = ValueOf<typeof MASS_TREND>;

/** One snapshot as the trend reads it. */
export interface MassTrendSample {
  readonly cellId: EntityId;
  readonly tick: number;
  readonly massFlow: MassFlowView | null;
  readonly effects: readonly GameEffect[];
}

/** A one-off mass change inside the window, at the snapshot tick it arrived with. */
interface MassEvent {
  readonly tick: number;
  readonly amount: number;
}

export interface MassTrendMemory {
  readonly cellId: EntityId;
  readonly tick: number;
  readonly trend: MassTrend;
  /** The net rate, mass/s; losses negative. */
  readonly ratePerSecond: number;
  readonly events: readonly MassEvent[];
}

const NO_CHANGE = 0;

/** The own cell's one-off changes in one snapshot: its eats, its engulf payouts, minus a sprint's cost. */
export function massEventAmountOf(sample: MassTrendSample): number {
  let amount = NO_CHANGE;
  for (const effect of sample.effects) {
    if (effect.kind === EFFECT_KIND.eat && effect.cellId === sample.cellId) amount += effect.massGained;
    if (effect.kind === EFFECT_KIND.cellAbsorbed && effect.predatorCellId === sample.cellId) {
      amount += effect.predatorMassGained;
    }
  }
  return amount - (sample.massFlow?.sprintSpent ?? NO_CHANGE);
}

function appliedRateOf(massFlow: MassFlowView | null): number {
  if (massFlow === null) return NO_CHANGE;
  return Object.values(massFlow.ratesPerSecond).reduce((sum, rate) => sum + rate, NO_CHANGE);
}

/**
 * Hysteresis: `steady` leaves only at `MASS_TREND_ENTER_PER_SECOND`, and a trend returns to `steady` only under
 * `MASS_TREND_EXIT_PER_SECOND`, so a rate sitting on the threshold does not flicker the glyph.
 */
export function trendFor(previous: MassTrend, ratePerSecond: number): MassTrend {
  const size = Math.abs(ratePerSecond);
  const direction = ratePerSecond < NO_CHANGE ? MASS_TREND.down : MASS_TREND.up;
  if (previous === MASS_TREND.steady) return size >= MASS_TREND_ENTER_PER_SECOND ? direction : MASS_TREND.steady;
  return size < MASS_TREND_EXIT_PER_SECOND ? MASS_TREND.steady : direction;
}

/**
 * The memory after `sample`. A new own cell id starts fresh (a respawn never reads 312 → 20 as a fall), and the same
 * tick seen again changes nothing, so a recomputation never counts a snapshot's amounts twice.
 */
export function massTrendFor(previous: MassTrendMemory | null, sample: MassTrendSample): MassTrendMemory {
  const carried = previous?.cellId === sample.cellId ? previous : null;
  if (carried !== null && carried.tick === sample.tick) return carried;
  const windowStartTick = sample.tick - secondsToTicks(MASS_TREND_WINDOW_SECONDS);
  const amount = massEventAmountOf(sample);
  const kept = (carried?.events ?? []).filter((event) => event.tick > windowStartTick);
  const events = amount === NO_CHANGE ? kept : [...kept, { tick: sample.tick, amount }];
  const windowAmount = events.reduce((sum, event) => sum + event.amount, NO_CHANGE);
  const ratePerSecond = appliedRateOf(sample.massFlow) + windowAmount / MASS_TREND_WINDOW_SECONDS;
  return {
    cellId: sample.cellId,
    tick: sample.tick,
    trend: trendFor(carried?.trend ?? MASS_TREND.steady, ratePerSecond),
    ratePerSecond,
    events,
  };
}
