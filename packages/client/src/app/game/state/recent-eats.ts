// What the own cell has eaten in the last `AFFECTING_FOOD_WINDOW_SECONDS` (docs/ui/overlays.md §3.7): the `Food`
// row's gain rate on the hold-Tab panel. Every amount is the server's own `massGained` (#383); nothing here
// re-derives a gain from a formula.
//
// A rate over a window is a question about the past, so the memory is carried from snapshot to snapshot by the
// caller (`GameStateService`), the way the mass trend's and the zone entries' are. The window is wider than the mass
// chip's `MASS_TREND_WINDOW_SECONDS` on purpose: the chip answers "what is happening now", this row answers "how
// fast am I feeding", and a mote every two seconds has to read as a steady rate rather than as a figure that blinks
// to zero between motes. Pure.

import { EFFECT_KIND, secondsToTicks, ticksToSeconds, type EntityId, type GameEffect } from '@evolution/shared';
import { AFFECTING_FOOD_WINDOW_SECONDS } from '../hud/hud-constants';

/** One snapshot as the food window reads it. */
export interface RecentEatsSample {
  readonly cellId: EntityId;
  readonly tick: number;
  readonly effects: readonly GameEffect[];
}

/** One snapshot's eaten mass, at the tick it arrived with. */
interface EatenAmount {
  readonly tick: number;
  readonly mass: number;
}

export interface RecentEatsMemory {
  readonly cellId: EntityId;
  readonly tick: number;
  readonly amounts: readonly EatenAmount[];
}

const WINDOW_TICKS = secondsToTicks(AFFECTING_FOOD_WINDOW_SECONDS);
const NOTHING = 0;

/** The mass the own cell's `eat` effects gained in one snapshot; engulf payouts are not food and are not counted. */
export function eatenMassOf(sample: RecentEatsSample): number {
  let mass = NOTHING;
  for (const effect of sample.effects) {
    if (effect.kind === EFFECT_KIND.eat && effect.cellId === sample.cellId) mass += effect.massGained;
  }
  return mass;
}

/**
 * The memory after `sample`. A new own cell id starts fresh, and a tick already seen changes nothing, so a
 * recomputation never counts a snapshot's eats twice.
 */
export function recentEatsFor(previous: RecentEatsMemory | null, sample: RecentEatsSample): RecentEatsMemory {
  const carried = previous?.cellId === sample.cellId ? previous : null;
  if (carried !== null && carried.tick === sample.tick) return carried;
  const eaten = eatenMassOf(sample);
  const carriedAmounts = carried?.amounts ?? [];
  const kept = eaten === NOTHING ? carriedAmounts : [...carriedAmounts, { tick: sample.tick, mass: eaten }];
  return {
    cellId: sample.cellId,
    tick: sample.tick,
    amounts: kept.filter((amount) => sample.tick - amount.tick <= WINDOW_TICKS),
  };
}

/**
 * The gain over the window as a rate, mass/s; zero for a memory of another cell or none at all, which omits the row
 * rather than showing `0` (§3.7). The window is the whole `AFFECTING_FOOD_WINDOW_SECONDS`, not the span of the
 * amounts in it: a single mote five seconds ago is a slow rate, not an instantaneous one.
 */
export function foodGainPerSecondFor(memory: RecentEatsMemory | null, cellId: EntityId): number {
  if (memory === null || memory.cellId !== cellId) return NOTHING;
  const gained = memory.amounts.reduce((sum, amount) => sum + amount.mass, NOTHING);
  return gained / ticksToSeconds(WINDOW_TICKS);
}
