// The round clock as numbers (docs/GAME-DESIGN.md §5.1, §5.4): whole ticks from the integer
// counter, never accumulated milliseconds, so the boundaries land on exact ticks.

import { secondsToTicks, ticksToMilliseconds, type BalanceConfig } from '@evolution/shared';
import type { WorldState } from '../world/world-state.js';

export function roundDurationTicks(world: WorldState): number {
  return secondsToTicks(world.config.roundDurationSeconds);
}

export function resultsDurationTicks(balance: BalanceConfig): number {
  return secondsToTicks(balance.session.RESULTS_SCREEN_SECONDS);
}

/** The bloom starts on the tick the round reaches `ROUND_BLOOM_START_FRACTION` of its length. */
export function bloomStartTick(world: WorldState, balance: BalanceConfig): number {
  return Math.floor(roundDurationTicks(world) * balance.session.ROUND_BLOOM_START_FRACTION);
}

export function isBloomActive(world: WorldState, balance: BalanceConfig): boolean {
  return world.roundElapsedTicks >= bloomStartTick(world, balance);
}

/** Milliseconds left in the round, derived from the tick counter (never below zero). */
export function roundTimeLeftMs(world: WorldState): number {
  return Math.max(0, ticksToMilliseconds(roundDurationTicks(world) - world.roundElapsedTicks));
}
