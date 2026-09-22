// Step 9 for the wild seats (docs/ecology/wild-cells.md §3.3 "Placement and respawn"): a seat whose cell was absorbed
// or removed starts a `WILD_CELL_RESPAWN_SECONDS` countdown on the tick it notices (the payout is step 6 of the same
// tick, so W4 reads `respawnInTicks` = 600 after tick 36), counts it down from the next tick and, on the tick after it
// reaches zero, places a new cell by the wild placement with a fresh spread factor (W4: alive again at tick 637).

import { secondsToTicks } from '@evolution/shared';
import { worldReferenceAt } from '../simulation/round-clock.js';
import type { WildSeatRecord } from '../world/entities.js';
import { findCell } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { placeWildCell } from './wild-seats.js';

/** The seat's cell is gone from the world: the countdown starts. */
function vacateSeat(seat: WildSeatRecord, context: StepContext): void {
  seat.cellId = null;
  seat.respawnInTicks = secondsToTicks(context.balance.wildCells.WILD_CELL_RESPAWN_SECONDS);
}

function advanceVacantSeat(world: WorldState, seat: WildSeatRecord, context: StepContext): void {
  if (seat.respawnInTicks > 0) {
    seat.respawnInTicks -= 1;
    return;
  }
  placeWildCell(world, seat, context, worldReferenceAt(world, world.tick));
}

export function runWildRespawns(world: WorldState, context: StepContext): void {
  for (const seat of world.wildSeats) {
    if (seat.cellId !== null) {
      if (findCell(world, seat.cellId) === undefined) {
        vacateSeat(seat, context);
      }
      continue;
    }
    advanceVacantSeat(world, seat, context);
  }
}
