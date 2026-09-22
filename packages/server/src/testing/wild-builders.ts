// A wild cell for the simulation tests (docs/testing/tiers-and-builders.md §4): a real seat and a cell seated through
// the wild placement (`seatWildCell`, docs/ecology/wild-cells.md §3.3), so a test of the death or the payout seam
// meets the record the world makes, `kind`, `organismId` and seat included, not a player cell with its id blanked.

import type { Vec2 } from '@evolution/shared';
import { worldReferenceAt } from '../game/simulation/round-clock.js';
import { setCellMass } from '../game/simulation/cell-mass.js';
import { createWildSeatRecord, seatWildCell } from '../game/wild/wild-seats.js';
import type { CellRecord, WildSeatRecord } from '../game/world/entities.js';
import type { WorldState } from '../game/world/world-state.js';

const FIRST_SEAT = 0;
/** The world's own mass: the pin is not run by these tests, `mass` overrides it when a row needs a number. */
const WORLD_SPREAD = 1;

export interface TestWildCellOptions {
  readonly seatNumber?: number;
  readonly at: Vec2;
  /** Set after seating, as the pin would set it on the next tick; left out, the cell is the world's mass. */
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
  const seating = { centre: options.at, spreadFactor: WORLD_SPREAD };
  const cell = seatWildCell(world, seat, seating, worldReferenceAt(world, world.tick));
  if (options.mass !== undefined) {
    setCellMass(cell, options.mass, world.balance);
  }
  return { seat, cell };
}
