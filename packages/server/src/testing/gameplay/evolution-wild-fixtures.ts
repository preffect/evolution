// The placed wild cell (docs/ecology/acceptance.md §8.1, docs/testing/scenario-runner.md §8.1 `.placeWildCell`): wild
// seat `seat`'s `sizeFactor` set to the fixture's, its cell placed (or replaced) at the resolved anchor and
// the seat cleared of target and velocity as a respawn does, so it has no target until its next decision tick
// (docs/ecology/wild-cells.md §3.3). A placed row has no seeded seats (placing anything vacates them), so the seat
// record is created on demand; a cell the seat already had (a second placement of the same seat) is withdrawn
// without detritus (a fixture leaves no meal behind: W4 counts the prey's two detritus motes and no others). The
// cell is seated through the simulation's own `seatWildCell`, so it is born at its base size with no growth.

import type { Vec2 } from '@evolution/shared';
import { worldReferenceAt } from '../../game/simulation/round-clock.js';
import { withdrawCell } from '../../game/session/death.js';
import { cellOfSeat } from '../../game/wild/wild-settle.js';
import { createWildSeatRecord, seatWildCell } from '../../game/wild/wild-seats.js';
import type { CellRecord, WildSeatRecord } from '../../game/world/entities.js';
import type { WorldState } from '../../game/world/world-state.js';
import { ScenarioSetupError } from './errors.js';
import type { PlacedWildCell } from './fixtures.js';

/** The seat record, created on demand for a seat number the dish has (`WILD_CELL_COUNT` seats, from 0). */
function seatOnDemand(world: WorldState, seatNumber: number): WildSeatRecord {
  const seatCount = world.balance.wildCells.WILD_CELL_COUNT;
  if (seatNumber >= seatCount) {
    throw new ScenarioSetupError(`wild seat ${seatNumber} does not exist (the dish has seats 0 to ${seatCount - 1})`);
  }
  const existing = world.wildSeats.find((candidate) => candidate.seatNumber === seatNumber);
  if (existing !== undefined) {
    return existing;
  }
  const seat = createWildSeatRecord(seatNumber);
  world.wildSeats.push(seat);
  world.wildSeats.sort((left, right) => left.seatNumber - right.seatNumber);
  return seat;
}

/** Seats the fixture's cell at `centre` (the anchor, resolved by the caller against the world). */
export function applyPlacedWildCell(world: WorldState, fixture: PlacedWildCell, centre: Vec2): CellRecord {
  const seat = seatOnDemand(world, fixture.seat);
  const previous = cellOfSeat(world, seat);
  if (previous !== undefined) {
    withdrawCell(world, previous);
  }
  const seating = { centre, sizeFactor: fixture.sizeFactor };
  return seatWildCell(world, seat, seating, worldReferenceAt(world, world.tick));
}
