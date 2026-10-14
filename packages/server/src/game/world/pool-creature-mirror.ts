// A pool creature's cell mirrors its seat (docs/architecture/entity-model.md §2, docs/game-design/phases.md §14.6): the
// seat is the creature's whole memory and is hashed in the eras' section, so the cell's `poolCreature` is derived, the
// way a wild cell's `isStarving` mirrors its seat's. This is the one writer of that mirror: whatever seats a creature's
// cell or turns its heading calls it, and the cell's radius follows its species (`cellRadiusOf`).

import { cellRadiusOf, type BalanceConfig } from '@evolution/shared';
import type { CellRecord, PoolCreatureSeatRecord } from './entities.js';

/** Copies the seat's species, landmark flag and heading onto its cell, and refreshes the cell's radius from them. */
export function mirrorPoolCreatureSeat(seat: PoolCreatureSeatRecord, cell: CellRecord, balance: BalanceConfig): void {
  cell.poolCreature = { species: seat.species, isLandmark: seat.isLandmark, headingRadians: seat.headingRadians };
  cell.radius = cellRadiusOf(cell, balance);
}
