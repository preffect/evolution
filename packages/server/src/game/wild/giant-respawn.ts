// Step 9 for the giant seats (docs/ecology/giants.md §3.5.8, §3.5.9): after the wild seats, by the wild count (a seat
// vacated on tick t reads `respawnInTicks` = `GIANT_RESPAWN_SECONDS` × 60 then and is alive again on the tick after it
// reaches zero), a giant whose cell was absorbed or removed comes back with a fresh born mass, no growth and its
// build, placed by the giant clearance from the `giants` stream. Its countdown is its profile's (`seat-profile.ts`).

import type { GiantSeatRecord } from '../world/entities.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { placeGiantCell } from './giant-seats.js';
import { giantSeatProfile } from './seat-profile.js';
import { runSeatRespawns } from './wild-respawn.js';

export function runGiantRespawns(world: WorldState, context: StepContext): void {
  runSeatRespawns<GiantSeatRecord>(world, world.giantSeats, {
    profileOf: (seat) => giantSeatProfile(seat.species, context.balance),
    place: (seat) => {
      placeGiantCell(world, seat, context.streams);
    },
  });
}
