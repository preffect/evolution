// A wild cell and a giant for the simulation tests (docs/testing/tiers-and-builders.md §4): a real seat and a cell
// seated through the simulation's own seating (`seatWildCell`, docs/ecology/wild-cells.md §3.3; `seatGiantCell`,
// docs/ecology/giants.md §3.5.9), so a test of the death or the payout seam meets the record the world makes, `kind`,
// `organismId`, species and seat included, not a player cell with its id blanked.

import { CELL_KIND, type GiantSpecies, type Vec2 } from '@evolution/shared';
import { worldReferenceAt } from '../game/simulation/round-clock.js';
import { giantSeatOf, seatGiantCell } from '../game/wild/giant-seats.js';
import { createWildSeatRecord, seatWildCell } from '../game/wild/wild-seats.js';
import type { CellRecord, GiantSeatRecord, WildSeatRecord } from '../game/world/entities.js';
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

export interface TestGiantCellOptions {
  readonly species: GiantSpecies;
  readonly at: Vec2;
  readonly bornMass: number;
  /** Growth above the born mass; none when left out. */
  readonly grownMass?: number;
}

export interface TestGiantCell {
  readonly seat: GiantSeatRecord;
  readonly cell: CellRecord;
}

/** Seats the species' giant at `at` in its own seat (created when the world has none). */
export function seatTestGiantCell(world: WorldState, options: TestGiantCellOptions): TestGiantCell {
  const seat = giantSeatOf(world, options.species);
  const seating = { centre: options.at, bornMass: options.bornMass, grownMass: options.grownMass ?? 0 };
  return { seat, cell: seatGiantCell(world, seat, seating) };
}

/** The wild seats' cells in world order: every wild cell but the giants (docs/ecology/giants.md §3.5.9). */
export function wildSeatCellsOf(cells: readonly CellRecord[]): CellRecord[] {
  return cells.filter((cell) => cell.kind === CELL_KIND.wild && cell.giantSpecies === null);
}
