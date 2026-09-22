// The placed wild cell (docs/ecology/acceptance.md §8.1, docs/testing/scenario-runner.md §8.1 `.placeWildCell`): wild
// seat `seat`'s `massSpreadFactor` set to `spreadFactor`, its cell placed (or replaced) at the resolved anchor and
// the seat cleared of target and velocity as a respawn does, so it has no target until its next decision tick
// (docs/ecology/wild-cells.md §3.3). The cell is seated through the simulation's own `seatWildCell`, so it is the
// world's average from its first tick; a cell the seat already had is withdrawn without detritus (a fixture leaves
// no meal behind: W4 counts the prey's two detritus motes and no others).

import type { Vec2 } from '@evolution/shared';
import { worldReferenceAt } from '../../game/simulation/round-clock.js';
import { withdrawCell } from '../../game/session/death.js';
import { cellOfSeat } from '../../game/wild/wild-pin.js';
import { seatWildCell } from '../../game/wild/wild-seats.js';
import type { CellRecord, WildSeatRecord } from '../../game/world/entities.js';
import type { WorldState } from '../../game/world/world-state.js';
import { ScenarioSetupError } from './errors.js';
import type { PlacedWildCell } from './fixtures.js';

function requireSeat(world: WorldState, seatNumber: number): WildSeatRecord {
  const seat = world.wildSeats.find((candidate) => candidate.seatNumber === seatNumber);
  if (seat === undefined) {
    throw new ScenarioSetupError(`wild seat ${seatNumber} does not exist (${world.wildSeats.length} seats)`);
  }
  return seat;
}

/** Seats the fixture's cell at `centre` (the anchor, resolved by the caller against the world). */
export function applyPlacedWildCell(world: WorldState, fixture: PlacedWildCell, centre: Vec2): CellRecord {
  const seat = requireSeat(world, fixture.seat);
  const previous = cellOfSeat(world, seat);
  if (previous !== undefined) {
    withdrawCell(world, previous);
  }
  const seating = { centre, spreadFactor: fixture.spreadFactor };
  return seatWildCell(world, seat, seating, worldReferenceAt(world, world.tick));
}
