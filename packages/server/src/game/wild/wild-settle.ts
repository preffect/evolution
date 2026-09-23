// Step 1's wild settle (docs/ecology/wild-cells.md §3.3.1, docs/architecture/server-simulation.md §3.4): every tick,
// after the players' inputs, each seated cell's mass is laid on its full size. A wild cell's size has two parts: the
// base size, `worldMass × sizeFactor`, which grows with the world and never decays, and the growth, everything it ate
// on top, which only the player's own decay removes. What steps 3–6 did to the cell since the last settle is its
// offset from last tick's full size: a net gain becomes permanent growth, a loss (a drain, a toxin, a sprint's cost)
// recovers with the `WILD_CELL_RECOVERY_SECONDS` time constant. The ladder is the world's: level, the seat's build up
// to that level, stage and modifiers are set from the world reference (`wild-build.ts`).

import { TICK_INTERVAL_S, type BalanceConfig, type WorldReference } from '@evolution/shared';
import { refreshCellDerivedStateFromTraits } from '../progression/modifiers.js';
import { setCellMass } from '../simulation/cell-mass.js';
import { decayPerSecond, metabolismInputOf } from '../simulation/metabolism.js';
import { worldReferenceAt } from '../simulation/round-clock.js';
import type { CellRecord, WildSeatRecord } from '../world/entities.js';
import { findCell } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { wildOwnedTraits } from './wild-build.js';

/** What one settle reads (docs/ecology/acceptance.md §8.1 W11). */
export interface WildSettleInput {
  /** The cell's mass now: last tick's settle plus everything steps 3–6 did since. */
  readonly mass: number;
  /** Last tick's full size (`seat.fullMass`). */
  readonly fullMass: number;
  readonly grownMass: number;
  /** §4's decay for this cell at `mass`, zone and trait multipliers included (mass/s); taken from the growth alone. */
  readonly decayPerSecond: number;
  /** This tick's base size, `worldMass × sizeFactor`. */
  readonly baseMass: number;
  readonly worldMass: number;
}

/** What one settle writes: the cell's mass and the seat's growth and full size. */
export interface WildSettleResult {
  readonly mass: number;
  readonly grownMass: number;
  readonly fullMass: number;
}

/** The share of a loss that is still missing one tick later: `1 − TICK_INTERVAL_S / WILD_CELL_RECOVERY_SECONDS`. */
export function wildRecoveryFactorPerTick(balance: BalanceConfig): number {
  return 1 - TICK_INTERVAL_S / balance.wildCells.WILD_CELL_RECOVERY_SECONDS;
}

/** `min(baseMass + grownMass, max(baseMass, ceiling))`: growth stops at the ceiling, a base above it is kept whole. */
function fullMassOf(baseMass: number, grownMass: number, worldMass: number, balance: BalanceConfig): number {
  const growthCeiling = balance.wildCells.WILD_CELL_MAX_WORLD_MASS_MULTIPLE * worldMass;
  return Math.min(baseMass + grownMass, Math.max(baseMass, growthCeiling));
}

/** The settle's pure core (docs/ecology/wild-cells.md §3.3.1). */
export function settleWildMass(input: WildSettleInput, balance: BalanceConfig): WildSettleResult {
  const offset = input.mass - input.fullMass;
  const grownWithMeal = input.grownMass + Math.max(0, offset);
  const wound = Math.min(0, offset) * wildRecoveryFactorPerTick(balance);
  const grownAfterDecay = Math.max(0, grownWithMeal - input.decayPerSecond * TICK_INTERVAL_S);
  const fullMass = fullMassOf(input.baseMass, grownAfterDecay, input.worldMass, balance);
  const floor = Math.min(balance.growth.CELL_STARTING_MASS, input.baseMass);
  return { mass: Math.max(floor, fullMass + wound), grownMass: fullMass - input.baseMass, fullMass };
}

/** `sizeFactor = MIN × (MAX / MIN)^u` for a unit draw `u` (log-uniform on [MIN, MAX]). */
export function wildSizeFactor(unit: number, balance: BalanceConfig): number {
  const { WILD_CELL_SIZE_FACTOR_MIN: smallest, WILD_CELL_SIZE_FACTOR_MAX: largest } = balance.wildCells;
  return smallest * (largest / smallest) ** unit;
}

/** The seat's base size at `reference`: the world's average mass times its own size factor. */
export function wildBaseMass(seat: WildSeatRecord, reference: WorldReference): number {
  return reference.worldMass * seat.sizeFactor;
}

/** Level, the seat's build up to that level, stage and modifiers from `reference`: the world's ladder. */
export function applyWorldLadder(
  cell: CellRecord,
  seat: WildSeatRecord,
  reference: WorldReference,
  balance: BalanceConfig,
): void {
  cell.level = Math.floor(reference.worldLevel);
  refreshCellDerivedStateFromTraits(cell, wildOwnedTraits(seat.seatNumber, cell.level, balance), balance);
}

/** Settles one cell against `reference`: the mass on the new full size, then the world's ladder. */
function settleWildCell(
  world: WorldState,
  seat: WildSeatRecord,
  cell: CellRecord,
  { reference, balance }: { readonly reference: WorldReference; readonly balance: BalanceConfig },
): void {
  const settled = settleWildMass(
    {
      mass: cell.mass,
      fullMass: seat.fullMass,
      grownMass: seat.grownMass,
      decayPerSecond: decayPerSecond(metabolismInputOf(cell, world, balance), balance),
      baseMass: wildBaseMass(seat, reference),
      worldMass: reference.worldMass,
    },
    balance,
  );
  seat.grownMass = settled.grownMass;
  seat.fullMass = settled.fullMass;
  setCellMass(cell, settled.mass, balance);
  applyWorldLadder(cell, seat, reference, balance);
}

/** The seat's cell, or `undefined` while the seat is vacant. */
export function cellOfSeat(world: WorldState, seat: WildSeatRecord): CellRecord | undefined {
  return seat.cellId === null ? undefined : findCell(world, seat.cellId);
}

/** Step 1 for the wild seats: every seated cell settled at this tick's world reference, in seat order. */
export function settleWildCells(world: WorldState, context: StepContext): void {
  const settleContext = { reference: worldReferenceAt(world, world.tick), balance: context.balance };
  for (const seat of world.wildSeats) {
    const cell = cellOfSeat(world, seat);
    if (cell !== undefined) {
      settleWildCell(world, seat, cell, settleContext);
    }
  }
}
