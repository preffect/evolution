// Late-join catch-up (docs/PROGRESSION.md §5): after the grace period a joiner receives a share
// of the living players' medians; the DNA share buys levels (drafts queued), never rank.

import { PLAYER_LIFE_STATE, clamp, secondsToTicks } from '@evolution/shared';
import type { PlayerRecord } from '../world/entities.js';
import { findCellOfPlayer } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { grantCatchUpGift } from './dna.js';
import { applyLevelUps } from './levels.js';

export interface LateJoinCatchUp {
  readonly dnaGift: number;
  readonly mass: number;
}

/** An even count has two middle values; the median is their mean. */
const MIDDLE_PAIR = 2;

/** The median of a non-empty list; an even count averages the middle two. */
export function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / MIDDLE_PAIR);
  if (sorted.length % MIDDLE_PAIR === 1) {
    return sorted[middle] as number;
  }
  return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / MIDDLE_PAIR;
}

function isAlive(player: PlayerRecord): boolean {
  return player.lifeState === PLAYER_LIFE_STATE.alive;
}

/** `null` before the grace period or when no other living player exists: the joiner starts fresh. */
export function computeLateJoinCatchUp(world: WorldState): LateJoinCatchUp | null {
  const { progression, growth } = world.balance;
  if (world.roundElapsedTicks <= secondsToTicks(progression.LATE_JOIN_GRACE_SECONDS)) {
    return null;
  }
  const living = world.players.filter(isAlive);
  if (living.length === 0) {
    return null;
  }
  const medianDna = medianOf(living.map((player) => player.dnaCumulative));
  const medianMass = medianOf(living.map((player) => findCellOfPlayer(world, player.playerId)?.mass ?? 0));
  return {
    dnaGift: Math.floor(progression.LATE_JOIN_DNA_FRACTION * medianDna),
    mass: clamp(
      progression.LATE_JOIN_MASS_FRACTION * medianMass,
      growth.CELL_STARTING_MASS,
      progression.LATE_JOIN_MAX_MASS,
    ),
  };
}

/** Grants the gift and climbs the levels it buys; the caller spawns the cell at `catchUp.mass`. */
export function applyCatchUp(
  world: WorldState,
  player: PlayerRecord,
  catchUp: LateJoinCatchUp,
  context: StepContext,
): void {
  grantCatchUpGift(player, catchUp.dnaGift);
  applyLevelUps(world, player, context);
}
