// The round clock as numbers (docs/GAME-DESIGN.md §5.1, §5.4; docs/ECOLOGY.md §3.1): whole ticks
// from the integer counter (`tick − roundStartTick`), never accumulated milliseconds, so the
// boundaries land on exact ticks; and the world reference the tick reads, computed here from the
// shared clock exactly as the HUD computes it from the snapshot.

import {
  secondsToTicks,
  ticksToMilliseconds,
  worldElapsedSeconds,
  worldReference,
  type BalanceConfig,
  type WorldReference,
} from '@evolution/shared';
import type { WorldState } from '../world/world-state.js';

/** The round clock's inputs: what the world carries. */
export type RoundClockWorld = Pick<WorldState, 'tick' | 'roundStartTick' | 'config' | 'balance'>;

export function roundDurationTicks(world: Pick<WorldState, 'config'>): number {
  return secondsToTicks(world.config.roundDurationSeconds);
}

export function resultsDurationTicks(balance: BalanceConfig): number {
  return secondsToTicks(balance.session.RESULTS_SCREEN_SECONDS);
}

/** Whole ticks since the round started at `tick` (uncapped: the results phase counts past the round length). */
export function roundElapsedTicksAt(world: Pick<WorldState, 'roundStartTick'>, tick: number): number {
  return tick - world.roundStartTick;
}

/** Whole ticks spent in the results phase at `tick`; negative while the round is still playing. */
export function resultsElapsedTicksAt(world: Pick<WorldState, 'roundStartTick' | 'config'>, tick: number): number {
  return roundElapsedTicksAt(world, tick) - roundDurationTicks(world);
}

/** The bloom starts on the tick the round reaches `ROUND_BLOOM_START_FRACTION` of its length. */
export function bloomStartTick(world: Pick<WorldState, 'config'>, balance: BalanceConfig): number {
  return Math.floor(roundDurationTicks(world) * balance.session.ROUND_BLOOM_START_FRACTION);
}

export function isBloomActive(
  world: Pick<WorldState, 'tick' | 'roundStartTick' | 'config'>,
  balance: BalanceConfig,
): boolean {
  return roundElapsedTicksAt(world, world.tick) >= bloomStartTick(world, balance);
}

/** Milliseconds left in the round at `tick`, derived from the tick counter (never below zero). */
export function roundTimeLeftMsAt(world: Pick<WorldState, 'roundStartTick' | 'config'>, tick: number): number {
  return Math.max(0, ticksToMilliseconds(roundDurationTicks(world) - roundElapsedTicksAt(world, tick)));
}

/**
 * The world's average cell at `tick` (docs/ECOLOGY.md §3.1): the shared formula over the shared
 * elapsed seconds, so the server and the HUD read one clock. Frozen through `results` by the cap.
 */
export function worldReferenceAt(world: RoundClockWorld, tick: number): WorldReference {
  return worldReference(
    worldElapsedSeconds(tick, world.roundStartTick, world.config.roundDurationSeconds),
    world.balance,
  );
}
