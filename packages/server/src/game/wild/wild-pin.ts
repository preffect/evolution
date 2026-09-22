// Step 1's wild pin (docs/ecology/wild-cells.md §3.3 "A wild cell is the world clock, not a player"): every tick, after
// the players' inputs, each seated cell's mass, level, traits and stage are set from the world reference. The mass
// is `max(CELL_STARTING_MASS, worldMass × massSpreadFactor − drainedMass)`; `drainedMass` is what step 5 took from
// the cell while it was engulfing ("Bleeding while engulfing"), so a wild predator loses mass tick for tick like a
// player predator and its `canContinueEngulf` fails on the same tick. A free cell is re-pinned in full: its
// `drainedMass` is cleared here, the first pin after a payout or a release (W10 reads the full pin on the next tick).

import type { BalanceConfig, WorldReference } from '@evolution/shared';
import { refreshCellDerivedStateFromTraits } from '../progression/modifiers.js';
import { setCellMass } from '../simulation/cell-mass.js';
import { isEngulfing } from '../simulation/engulf-state.js';
import { worldReferenceAt } from '../simulation/round-clock.js';
import type { CellRecord, WildSeatRecord } from '../world/entities.js';
import { findCell } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { wildOwnedTraits } from './wild-build.js';

/** The pinned mass: the world's, spread by the seat, less what an engulfing cell has bled, never below the floor. */
export function pinnedWildMass(seat: WildSeatRecord, reference: WorldReference, balance: BalanceConfig): number {
  const fullPin = reference.worldMass * seat.massSpreadFactor;
  return Math.max(Math.min(balance.growth.CELL_STARTING_MASS, fullPin), fullPin - seat.drainedMass);
}

/** Pins one cell to `reference`: mass and radius, level, the seat's build up to that level, stage and modifiers. */
export function pinWildCell(
  cell: CellRecord,
  seat: WildSeatRecord,
  reference: WorldReference,
  balance: BalanceConfig,
): void {
  if (!isEngulfing(cell)) {
    seat.drainedMass = 0;
  }
  setCellMass(cell, pinnedWildMass(seat, reference, balance), balance);
  cell.level = Math.floor(reference.worldLevel);
  refreshCellDerivedStateFromTraits(cell, wildOwnedTraits(seat.seatNumber, cell.level, balance), balance);
}

/** The seat's cell, or `undefined` while the seat is vacant. */
export function cellOfSeat(world: WorldState, seat: WildSeatRecord): CellRecord | undefined {
  return seat.cellId === null ? undefined : findCell(world, seat.cellId);
}

/** Step 1 for the wild seats: every seated cell pinned to this tick's world reference, in seat order. */
export function pinWildCells(world: WorldState, context: StepContext): void {
  const reference = worldReferenceAt(world, world.tick);
  for (const seat of world.wildSeats) {
    const cell = cellOfSeat(world, seat);
    if (cell !== undefined) {
      pinWildCell(cell, seat, reference, context.balance);
    }
  }
}

/** The seat owning `cell`, if it is a wild cell. */
export function wildSeatOfCell(world: WorldState, cell: CellRecord): WildSeatRecord | undefined {
  return world.wildSeats.find((seat) => seat.cellId === cell.id);
}

/** Step 5 books what it removed from an engulfing wild cell against its seat; the next pin subtracts it. */
export function recordWildDrain(world: WorldState, cell: CellRecord, removed: number): void {
  const seat = wildSeatOfCell(world, cell);
  if (seat !== undefined) {
    seat.drainedMass += removed;
  }
}
