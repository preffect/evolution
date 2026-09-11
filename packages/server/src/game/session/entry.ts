// Entering the dish after tick 0 (docs/PROGRESSION.md §5): a late joiner and a respawning player
// both come through `entryState`, which composes the shared `entryMass` / `entryDnaFloor`
// formulas over the world reference at the entry tick. The world clock is the floor; a late
// joiner past the grace with another living player is also lifted toward the living players'
// medians. The raise is a score-neutral gift that buys levels (drafts queued), never rank.

import {
  PLAYER_LIFE_STATE,
  entryDnaFloor,
  entryMass,
  secondsToTicks,
  type BalanceConfig,
  type WorldReference,
} from '@evolution/shared';
import { grantCatchUpGift } from '../progression/dna.js';
import { applyLevelUps } from '../progression/levels.js';
import { showQueuedOfferIfNone } from '../progression/offers.js';
import type { PlayerRecord } from '../world/entities.js';
import { requireCellOfPlayer } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { roundElapsedTicksAt } from '../simulation/round-clock.js';

/** The living players' medians a late joiner is measured against. */
export interface EntryMedians {
  readonly mass: number;
  readonly dnaCumulative: number;
}

/** What the entering cell starts with: the DNA raise (added to the gift) and the mass. */
export interface EntryState {
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

/** The one rule (docs/PROGRESSION.md §5): `medians` is null for a respawn or a join inside the grace. */
export function entryState(
  current: Pick<PlayerRecord, 'dnaCumulative'>,
  medians: EntryMedians | null,
  reference: WorldReference,
  balance: BalanceConfig,
): EntryState {
  const floor = entryDnaFloor(current.dnaCumulative, medians?.dnaCumulative ?? null, reference, balance);
  return {
    dnaGift: floor - current.dnaCumulative,
    mass: entryMass(medians?.mass ?? null, reference, balance),
  };
}

function isAlive(player: PlayerRecord): boolean {
  return player.lifeState === PLAYER_LIFE_STATE.alive;
}

/** The living players' medians, or null when nobody is alive (a spectating player has no cell; an alive one must). */
export function livingMedians(world: WorldState): EntryMedians | null {
  const living = world.players.filter(isAlive);
  if (living.length === 0) {
    return null;
  }
  return {
    mass: medianOf(living.map((player) => requireCellOfPlayer(world, player.playerId).mass)),
    dnaCumulative: medianOf(living.map((player) => player.dnaCumulative)),
  };
}

/** The median term exists only for a join after `ENTRY_GRACE_SECONDS` with another living player. */
export function lateJoinMedians(world: WorldState, entryTick: number): EntryMedians | null {
  const graceTicks = secondsToTicks(world.balance.progression.ENTRY_GRACE_SECONDS);
  if (roundElapsedTicksAt(world, entryTick) <= graceTicks) {
    return null;
  }
  return livingMedians(world);
}

/**
 * Grants the DNA raise as a catch-up gift and climbs the levels it buys, one draft per level; the
 * first draft is shown at once so the entering cell sees its cards on its first tick. The caller
 * has already placed the cell at `state.mass`.
 */
export function applyEntryState(
  world: WorldState,
  player: PlayerRecord,
  state: EntryState,
  context: StepContext,
): void {
  if (state.dnaGift > 0) {
    grantCatchUpGift(player, state.dnaGift);
  }
  if (applyLevelUps(world, player, context) > 0) {
    showQueuedOfferIfNone(world, player, context);
  }
}
