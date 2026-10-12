// Step 9 for the wild seats (docs/ecology/wild-cells.md §3.3 "Placement and respawn"): a seat whose cell was absorbed
// or removed starts a `WILD_CELL_RESPAWN_SECONDS` countdown on the tick it notices (the payout is step 6 of the same
// tick, so W4 reads `respawnInTicks` = 600 after tick 36), counts it down from the next tick and, on the tick after it
// reaches zero, places a new cell by the wild placement with a fresh spread factor (W4: alive again at tick 637). The
// countdown and what a vacated seat forgets are the seat's profile (`seat-profile.ts`); the giant seats respawn by the
// same count with their own profile and placement (`giant-respawn.ts`).

import { secondsToTicks } from '@evolution/shared';
import { worldReferenceAt } from '../simulation/round-clock.js';
import type { SeatMindRecord, WildSeatRecord } from '../world/entities.js';
import { indexCellsById } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { wildSeatProfile, type SeatProfile } from './seat-profile.js';
import { placeWildCell } from './wild-seats.js';

/** How one kind of seat respawns: each seat's profile (its countdown and what it forgets) and its placement. */
export interface SeatRespawns<Seat extends SeatMindRecord> {
  readonly profileOf: (seat: Seat) => SeatProfile<Seat>;
  readonly place: (seat: Seat) => void;
}

/** The seat's cell is gone from the world: the countdown starts. */
function vacateSeat<Seat extends SeatMindRecord>(seat: Seat, profile: SeatProfile<Seat>): void {
  seat.cellId = null;
  profile.forgetOnVacate(seat);
  seat.respawnInTicks = secondsToTicks(profile.respawnSeconds);
}

/** Every seat of `seats`, in seat order: a seat whose cell is gone is vacated, a vacant one counts down or is placed. */
export function runSeatRespawns<Seat extends SeatMindRecord>(
  world: WorldState,
  seats: readonly Seat[],
  respawns: SeatRespawns<Seat>,
): void {
  // A placement appends a cell for its own seat only, so the index stays true for the seats after it.
  const cellsById = indexCellsById(world);
  for (const seat of seats) {
    if (seat.cellId !== null) {
      if (!cellsById.has(seat.cellId)) {
        vacateSeat(seat, respawns.profileOf(seat));
      }
    } else if (seat.respawnInTicks > 0) {
      seat.respawnInTicks -= 1;
    } else {
      respawns.place(seat);
    }
  }
}

export function runWildRespawns(world: WorldState, context: StepContext): void {
  const profile = wildSeatProfile(context.balance);
  runSeatRespawns<WildSeatRecord>(world, world.wildSeats, {
    profileOf: () => profile,
    place: (seat) => {
      placeWildCell(world, seat, context, worldReferenceAt(world, world.tick));
    },
  });
}
