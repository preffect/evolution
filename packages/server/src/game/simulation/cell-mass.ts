// The one place a cell's mass changes and its radius follows (docs/ecology/mass-and-movement.md §5.1, §5.4). Mass
// gained past `CELL_MAX_MASS` converts to DNA at `MASS_OVERFLOW_DNA_PER_MASS`, so eating at the
// cap still progresses the leaderboard.

import { radiusForMass, type BalanceConfig } from '@evolution/shared';
import { gainDna } from '../progression/dna.js';
import { isPlayerCell, type CellRecord, type PlayerRecord } from '../world/entities.js';

/** Sets the mass and refreshes the radius; never applies the cap (callers that gain mass use `gainMass`). */
export function setCellMass(cell: CellRecord, mass: number, balance: BalanceConfig): void {
  cell.mass = mass;
  cell.radius = radiusForMass(mass, balance.growth);
}

/**
 * Adds `amount` to the cell; the part above the cap becomes DNA for `player`. A cell with no player (a wild
 * cell) is clamped to the cap and gains no DNA.
 */
export function gainMass(
  cell: CellRecord,
  player: PlayerRecord | undefined,
  amount: number,
  balance: BalanceConfig,
): void {
  const maxMass = balance.growth.CELL_MAX_MASS;
  const raised = cell.mass + amount;
  if (raised > maxMass && player !== undefined) {
    gainDna(player, (raised - maxMass) * balance.growth.MASS_OVERFLOW_DNA_PER_MASS, cell.modifiers.dnaGainMultiplier);
  }
  setCellMass(cell, Math.min(raised, maxMass), balance);
}

/** What one meal added, measured around the gains (#383): the snapshot reports these, never a formula's value. */
export interface MeasuredGain {
  readonly massGained: number;
  readonly dnaGained: number;
}

/** A payout that added nothing. */
export const NO_GAIN: MeasuredGain = { massGained: 0, dnaGained: 0 };

/** Runs `applyGains` and returns how far it moved the cell's mass and the player's lifetime DNA. */
export function measureGain(cell: CellRecord, player: PlayerRecord, applyGains: () => void): MeasuredGain {
  const massBefore = cell.mass;
  const dnaBefore = player.dnaCumulative;
  applyGains();
  return { massGained: cell.mass - massBefore, dnaGained: player.dnaCumulative - dnaBefore };
}

/**
 * The lowest mass a loss may leave: the starting mass for a player cell, and for a wild cell
 * `min(CELL_STARTING_MASS, massBefore)`, so a loss never lifts a wild cell born below 20 to 20 (which the settle
 * would then book as growth; docs/architecture/server-simulation.md §3.4).
 */
export function massFloorOf(cell: CellRecord, massBefore: number, balance: BalanceConfig): number {
  const startingMass = balance.growth.CELL_STARTING_MASS;
  return isPlayerCell(cell) ? startingMass : Math.min(startingMass, massBefore);
}

/** Drops mass to `mass` but never below the cell's floor (the metabolism step's decay and drains floor there). */
export function loseMassToFloor(cell: CellRecord, mass: number, balance: BalanceConfig): void {
  setCellMass(cell, Math.max(massFloorOf(cell, cell.mass, balance), mass), balance);
}
