// The one place a cell's mass changes and its radius follows (docs/ECOLOGY.md §5.1, §5.4). Mass
// gained past `CELL_MAX_MASS` converts to DNA at `MASS_OVERFLOW_DNA_PER_MASS`, so eating at the
// cap still progresses the leaderboard.

import { radiusForMass, type BalanceConfig } from '@evolution/shared';
import { gainDna } from '../progression/dna.js';
import type { CellRecord, PlayerRecord } from '../world/entities.js';

/** Sets the mass and refreshes the radius; never applies the cap (callers that gain mass use `gainMass`). */
export function setCellMass(cell: CellRecord, mass: number, balance: BalanceConfig): void {
  cell.mass = mass;
  cell.radius = radiusForMass(mass, balance.growth);
}

/** Adds `amount` to the cell; the part above the cap becomes DNA for `player`. */
export function gainMass(cell: CellRecord, player: PlayerRecord, amount: number, balance: BalanceConfig): void {
  const maxMass = balance.growth.CELL_MAX_MASS;
  const raised = cell.mass + amount;
  if (raised > maxMass) {
    gainDna(player, (raised - maxMass) * balance.growth.MASS_OVERFLOW_DNA_PER_MASS, cell.modifiers.dnaGainMultiplier);
  }
  setCellMass(cell, Math.min(raised, maxMass), balance);
}

/** Drops mass to `mass` but never below the starting mass (decay, drains and the sprint cost floor there). */
export function loseMassToFloor(cell: CellRecord, mass: number, balance: BalanceConfig): void {
  setCellMass(cell, Math.max(balance.growth.CELL_STARTING_MASS, mass), balance);
}
