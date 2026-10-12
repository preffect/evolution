// Step 9 for the wild seats (docs/ecology/wild-cells.md §3.3 "Placement and respawn"): a seat whose cell was absorbed
// or removed starts a `WILD_CELL_RESPAWN_SECONDS` countdown on the tick it notices (the payout is step 6 of the same
// tick, so W4 reads `respawnInTicks` = 600 after tick 36), counts it down from the next tick and, on the tick after it
// reaches zero, places a new cell by the wild placement with a fresh spread factor (W4: alive again at tick 637). The
// giant seats respawn by the same count with their own countdown and placement (`giant-respawn.ts`).

import { secondsToTicks } from '@evolution/shared';
import { worldReferenceAt } from '../simulation/round-clock.js';
import type { SeatMindRecord, WildSeatRecord } from '../world/entities.js';
import { indexCellsById } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { placeWildCell } from './wild-seats.js';

/** How one kind of seat respawns: its countdown, what else a vacated seat forgets, and its placement. */
export interface SeatRespawnPolicy<Seat extends SeatMindRecord> {
  readonly respawnTicks: number;
  readonly forgetOnVacate: (seat: Seat) => void;
  readonly place: (seat: Seat) => void;
}

/** The seat's cell is gone from the world: the countdown starts. */
function vacateSeat<Seat extends SeatMindRecord>(seat: Seat, policy: SeatRespawnPolicy<Seat>): void {
  seat.cellId = null;
  policy.forgetOnVacate(seat);
  seat.respawnInTicks = policy.respawnTicks;
}

/** Every seat of `seats`, in seat order: a seat whose cell is gone is vacated, a vacant one counts down or is placed. */
export function runSeatRespawns<Seat extends SeatMindRecord>(
  world: WorldState,
  seats: readonly Seat[],
  policy: SeatRespawnPolicy<Seat>,
): void {
  // A placement appends a cell for its own seat only, so the index stays true for the seats after it.
  const cellsById = indexCellsById(world);
  for (const seat of seats) {
    if (seat.cellId !== null) {
      if (!cellsById.has(seat.cellId)) {
        vacateSeat(seat, policy);
      }
    } else if (seat.respawnInTicks > 0) {
      seat.respawnInTicks -= 1;
    } else {
      policy.place(seat);
    }
  }
}

export function runWildRespawns(world: WorldState, context: StepContext): void {
  runSeatRespawns<WildSeatRecord>(world, world.wildSeats, {
    respawnTicks: secondsToTicks(context.balance.wildCells.WILD_CELL_RESPAWN_SECONDS),
    forgetOnVacate: (seat) => {
      seat.isStarving = false; // a starver eaten before it burst dies of that (docs/ecology/wild-cells.md §3.3.6)
    },
    place: (seat) => {
      placeWildCell(world, seat, context, worldReferenceAt(world, world.tick));
    },
  });
}
