// Step 9 for the giant seats (docs/ecology/giants.md §3.5.8, §3.5.9): after the wild seats, by the wild count (a seat
// vacated on tick t reads `respawnInTicks` = `GIANT_RESPAWN_SECONDS` × 60 then and is alive again on the tick after it
// reaches zero), a giant whose cell was absorbed or removed comes back with a fresh born mass, no growth and its
// build, placed by the giant clearance from the `giants` stream.

import { secondsToTicks } from '@evolution/shared';
import type { GiantSeatRecord } from '../world/entities.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { placeGiantCell } from './giant-seats.js';
import { runSeatRespawns } from './wild-respawn.js';

/** A giant seat keeps nothing past its cell but its species: the seat itself forgets nothing more. */
const FORGET_NOTHING = (): void => undefined;

export function runGiantRespawns(world: WorldState, context: StepContext): void {
  runSeatRespawns<GiantSeatRecord>(world, world.giantSeats, {
    respawnTicks: secondsToTicks(context.balance.giants.GIANT_RESPAWN_SECONDS),
    forgetOnVacate: FORGET_NOTHING,
    place: (seat) => {
      placeGiantCell(world, seat, context.streams);
    },
  });
}
