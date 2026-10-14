// A pool creature's seat and its cell (docs/architecture/entity-model.md §2, docs/game-design/phases.md §14.6). The seat
// is the creature's whole memory and is hashed in the eras' section, so the cell's `poolCreature` is derived, the way a
// wild cell's `isStarving` mirrors its seat's. `mirrorPoolCreatureSeat` is the one writer of that mirror: whatever
// seats a creature's cell or turns its mind's heading calls it, and the cell's radius follows its species
// (`cellRadiusOf`). The seats are numbered after the giants' (`poolCreatureSeatNumber`), so the mind's decision
// stagger, keyed on the seat number, never shares a giant's or a wild seat's number.

import { GIANT_SPECIES_ORDER, cellRadiusOf, type BalanceConfig } from '@evolution/shared';
import type { CellRecord, PoolCreatureSeatRecord } from './entities.js';

/** The number of the seat at `place` in `poolCreatureSeats`: after every giant seat a world can have. */
export function poolCreatureSeatNumber(firstGiantSeatNumber: number, place: number): number {
  return firstGiantSeatNumber + GIANT_SPECIES_ORDER.length + place;
}

/**
 * Copies the seat's species and landmark flag onto its cell, and its mind's heading as the angle the body lies at
 * (one fact, one home: the nematode's chain is laid along the way it swims), then refreshes the cell's radius.
 */
export function mirrorPoolCreatureSeat(seat: PoolCreatureSeatRecord, cell: CellRecord, balance: BalanceConfig): void {
  const headingRadians = Math.atan2(seat.headingY, seat.headingX);
  cell.poolCreature = { species: seat.species, isLandmark: seat.isLandmark, headingRadians };
  cell.radius = cellRadiusOf(cell, balance);
}
