// The wild hunt gives up (docs/ecology/wild-cells.md §3.3.3, ticket #738): a hunter that has chased the same prey for
// `WILD_CELL_HUNT_GIVE_UP_SECONDS` without starting an engulf on it abandons that prey, and leaves it out of its hunts
// until it gives up on another (the seat remembers one, `givenUpPreyId`). The seat keeps the tick its current hunt
// began (`huntStartTick`); a decision that picks the same prey again continues that hunt, a new prey starts a new one.
// After giving up, the seat rests: it hunts nothing until `huntRestUntilTick`, `WILD_CELL_HUNT_REST_SECONDS` on, so a
// hunter that drops a wild cell does not turn straight to the next prey in sight (often a player).
// The charge stays at full strength, so a hunt still ends in a swallow or a give-up, not a ride alongside the prey.
//
// No randomness; the checks run on a seat's decision ticks only.

import { secondsToTicks, type BalanceConfig, type EntityId } from '@evolution/shared';
import { isEngulfing } from '../simulation/engulf-state.js';
import type { CellRecord, WildSeatRecord } from '../world/entities.js';

/** Whether the seat's hunt has run `WILD_CELL_HUNT_GIVE_UP_SECONDS` by `tick` and its cell engulfs nothing. */
export function isHuntStale(seat: WildSeatRecord, cell: CellRecord, tick: number, balance: BalanceConfig): boolean {
  const giveUpTicks = secondsToTicks(balance.wildCells.WILD_CELL_HUNT_GIVE_UP_SECONDS);
  return seat.huntPreyId !== null && !isEngulfing(cell) && tick - seat.huntStartTick >= giveUpTicks;
}

/** Before a decision: a stale hunt ends, its prey becomes the one the seat leaves out of its hunts, and it rests. */
export function giveUpStaleHunt(seat: WildSeatRecord, cell: CellRecord, tick: number, balance: BalanceConfig): void {
  if (!isHuntStale(seat, cell, tick, balance)) {
    return;
  }
  seat.givenUpPreyId = seat.huntPreyId;
  seat.huntPreyId = null;
  seat.huntRestUntilTick = tick + secondsToTicks(balance.wildCells.WILD_CELL_HUNT_REST_SECONDS);
}

/** Whether the seat still rests from its last give-up on `tick`: it hunts nothing until `huntRestUntilTick`. */
export function isHuntResting(seat: WildSeatRecord, tick: number): boolean {
  return tick < seat.huntRestUntilTick;
}

/** After a decision: latches the hunted prey, starting the hunt's clock on `tick` unless it is the same prey as before. */
export function latchHunt(seat: WildSeatRecord, huntPreyId: EntityId | null, tick: number): void {
  if (huntPreyId !== seat.huntPreyId) {
    seat.huntStartTick = tick;
  }
  seat.huntPreyId = huntPreyId;
}
