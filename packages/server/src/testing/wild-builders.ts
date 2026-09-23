// A wild cell for the simulation tests (docs/testing/tiers-and-builders.md §4): a real seat and a cell seated through
// the wild placement (`seatWildCell`, docs/ecology/wild-cells.md §3.3), so a test of the death or the payout seam
// meets the record the world makes, `kind`, `organismId` and seat included, not a player cell with its id blanked.

import type { Vec2 } from '@evolution/shared';
import { worldReferenceAt } from '../game/simulation/round-clock.js';
import { createWildSeatRecord, seatWildCell } from '../game/wild/wild-seats.js';
import type { CellRecord, WildSeatRecord } from '../game/world/entities.js';
import type { WorldState } from '../game/world/world-state.js';

const FIRST_SEAT = 0;
/** The world's own mass, unless `mass` asks for another base size. */
const WORLD_SIZE = 1;

export interface TestWildCellOptions {
  readonly seatNumber?: number;
  readonly at: Vec2;
  /** The cell's base size (its size factor is chosen to match), with no growth; left out, the world's mass. */
  readonly mass?: number;
}

export interface TestWildCell {
  readonly seat: WildSeatRecord;
  readonly cell: CellRecord;
}

/** Seats a wild cell at `at` on seat `seatNumber` (created when the world has no such seat). */
export function seatTestWildCell(world: WorldState, options: TestWildCellOptions): TestWildCell {
  const seatNumber = options.seatNumber ?? FIRST_SEAT;
  let seat = world.wildSeats.find((candidate) => candidate.seatNumber === seatNumber);
  if (seat === undefined) {
    seat = createWildSeatRecord(seatNumber);
    world.wildSeats.push(seat);
  }
  const reference = worldReferenceAt(world, world.tick);
  const sizeFactor = options.mass === undefined ? WORLD_SIZE : options.mass / reference.worldMass;
  const cell = seatWildCell(world, seat, { centre: options.at, sizeFactor }, reference);
  return { seat, cell };
}
