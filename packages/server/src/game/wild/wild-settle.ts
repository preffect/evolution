// Step 1's wild settle (docs/ecology/wild-cells.md §3.3.1, docs/architecture/server-simulation.md §3.4): every tick,
// after the players' inputs, each seated cell's mass is laid on its full size. A wild cell's size has two parts: the
// base size, `worldMass × sizeFactor`, which grows with the world and never decays, and the growth, everything it ate
// on top, which only the player's own decay removes. What steps 3–6 did to the cell since the last settle is its
// offset from last tick's full size: a net gain becomes permanent growth, a loss (a drain, a toxin) recovers with the
// `WILD_CELL_RECOVERY_SECONDS` time constant. A sprint's cost is spent from the growth first: step 1 takes that part
// off the growth before the next settle (`wild-strategy.ts`), and only the rest reaches the settle, as a wound. The
// ladder is the world's: level, the seat's build up to that level, stage and modifiers are set from the world
// reference (`wild-build.ts`).

import {
  RANDOM_STREAM,
  TICK_INTERVAL_S,
  worldWholeLevel,
  type BalanceConfig,
  type RandomSource,
  type WorldReference,
} from '@evolution/shared';
import { refreshCellDerivedStateFromTraits } from '../progression/modifiers.js';
import { setCellMass } from '../simulation/cell-mass.js';
import { decayPerSecond, metabolismInputOf } from '../simulation/metabolism.js';
import { worldReferenceAt } from '../simulation/round-clock.js';
import type { CellRecord, WildSeatRecord } from '../world/entities.js';
import { seatedWildCells } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { wildOwnedTraits } from './wild-build.js';
import { burstStarvedCell, chooseWildStarver, isStarvedOut, starveSettled } from './wild-die-off.js';

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
  cell.level = worldWholeLevel(reference);
  refreshCellDerivedStateFromTraits(cell, wildOwnedTraits(seat.seatNumber, cell.level, balance), balance);
}

/** What every settle of one tick reads: the world reference and the live balance. */
interface SettleContext {
  readonly reference: WorldReference;
  readonly balance: BalanceConfig;
}

/** The settle, then one tick of starvation when the seat is starving (§3.3.6), written back to the seat. */
function settledMassOf(world: WorldState, seat: WildSeatRecord, cell: CellRecord, context: SettleContext): number {
  const { reference, balance } = context;
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
  if (!seat.isStarving) {
    return recordSettle(seat, settled);
  }
  const starved = starveSettled(settled, seat.sizeFactor, reference.worldMass, balance);
  seat.sizeFactor = starved.sizeFactor;
  return recordSettle(seat, starved);
}

/** Writes a settle's growth and full size to the seat and answers the cell's new mass. */
function recordSettle(seat: WildSeatRecord, outcome: WildSettleResult): number {
  seat.grownMass = outcome.grownMass;
  seat.fullMass = outcome.fullMass;
  return outcome.mass;
}

/** Settles one cell against `reference`: the mass on the new full size, the world's ladder, and a starved-out burst. */
function settleWildCell(
  world: WorldState,
  seat: WildSeatRecord,
  cell: CellRecord,
  context: SettleContext & { readonly spawner: RandomSource },
): void {
  const { reference, balance } = context;
  setCellMass(cell, settledMassOf(world, seat, cell, context), balance);
  applyWorldLadder(cell, seat, reference, balance);
  if (seat.isStarving && isStarvedOut(seat.fullMass, reference.worldMass, balance)) {
    burstStarvedCell(world, seat, cell, context.spawner);
  }
}

/**
 * Step 1 for the wild seats: the die-off picks a starver if the dish is over its budget (§3.3.6), then every seated
 * cell is settled at this tick's world reference, in seat order.
 */
export function settleWildCells(world: WorldState, context: StepContext): void {
  const reference = worldReferenceAt(world, world.tick);
  const settleContext = { reference, balance: context.balance, spawner: context.streams[RANDOM_STREAM.spawner] };
  // A burst removes only the settling seat's own cell, so the list stays true for the seats after it.
  const seated = seatedWildCells(world);
  chooseWildStarver(seated, reference.worldMass, context.balance);
  for (const { seat, cell } of seated) {
    settleWildCell(world, seat, cell, settleContext);
  }
}
