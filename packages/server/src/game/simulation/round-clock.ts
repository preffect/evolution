// The round clock as numbers (docs/game-design/session.md §5.1, §5.4; docs/ecology/food-and-spawn.md §3.1): whole ticks
// from the integer counter (`tick − roundStartTick`), never accumulated milliseconds, so the
// boundaries land on exact ticks; and the world reference the tick reads, computed here from the
// shared clock exactly as the HUD computes it from the snapshot; and the era the clock reads at a tick (`eraAt`,
// docs/game-design/phases.md §14.2.1).

import {
  dishEraEndSeconds,
  eraAt,
  secondsToTicks,
  ticksToMilliseconds,
  worldElapsedSeconds,
  worldReferenceInEra,
  type BalanceConfig,
  type EraClockBalance,
  type GameEra,
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

/**
 * The ticks after `roundStartTick` the dish era ends on (docs/game-design/phases.md §14.2.1): the next reachable era's
 * start, else the round's end, so with the eras off the bloom runs to the round's end as it always has.
 */
export function dishEraEndTicks(world: Pick<WorldState, 'config'>, balance: BalanceConfig): number {
  return secondsToTicks(dishEraEndSeconds(world.config.roundDurationSeconds, balance));
}

/** The bloom starts on the tick the dish era reaches `ROUND_BLOOM_START_FRACTION` of its length. */
export function bloomStartTick(world: Pick<WorldState, 'config'>, balance: BalanceConfig): number {
  return Math.floor(dishEraEndTicks(world, balance) * balance.session.ROUND_BLOOM_START_FRACTION);
}

/** The bloom belongs to the dish: from its start to the dish era's end (8:00–10:00 with the pool in play). */
export function isBloomActive(
  world: Pick<WorldState, 'tick' | 'roundStartTick' | 'config'>,
  balance: BalanceConfig,
): boolean {
  const elapsedTicks = roundElapsedTicksAt(world, world.tick);
  return elapsedTicks >= bloomStartTick(world, balance) && elapsedTicks < dishEraEndTicks(world, balance);
}

/** Milliseconds left in the round at `tick`, derived from the tick counter (never below zero). */
export function roundTimeLeftMsAt(world: Pick<WorldState, 'roundStartTick' | 'config'>, tick: number): number {
  return Math.max(0, ticksToMilliseconds(roundDurationTicks(world) - roundElapsedTicksAt(world, tick)));
}

/**
 * The world's average cell at `tick` (docs/ecology/food-and-spawn.md §3.1): the shared formula over the shared
 * elapsed seconds, so the server and the HUD read one clock; its mass restarts at the pool's move
 * (docs/game-design/phases.md §14.2.2). Frozen through `results` by the cap.
 */
export function worldReferenceAt(world: RoundClockWorld, tick: number): WorldReference {
  const roundDurationSeconds = world.config.roundDurationSeconds;
  return worldReferenceInEra(
    worldElapsedSeconds(tick, world.roundStartTick, roundDurationSeconds),
    roundDurationSeconds,
    world.balance,
  );
}

/**
 * The era the round clock reads at `tick`, on `balance` (the world's own by default; a patch is read on its result
 * before it lands). The clock's era, not the era the world has moved into (architecture/server-simulation.md §3).
 */
export function roundEraAt(world: RoundClockWorld, tick: number, balance: EraClockBalance = world.balance): GameEra {
  const roundDurationSeconds = world.config.roundDurationSeconds;
  return eraAt(worldElapsedSeconds(tick, world.roundStartTick, roundDurationSeconds), roundDurationSeconds, balance);
}
