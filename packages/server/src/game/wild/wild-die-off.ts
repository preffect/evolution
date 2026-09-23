// The die-off (docs/ecology/wild-cells.md §3.3.6, #555): the dish feeds only `WILD_CELL_CARRYING_CAPACITY_MULTIPLE` ×
// `WILD_CELL_COUNT` × `worldMass` of wild life. While the seated wild cells weigh more, the heaviest starts to starve
// (ties to the lower seat), one at a time and committed until it dies: each settle takes
// `WILD_CELL_STARVATION_FRACTION_PER_SECOND` of its full size, from its growth first and then from its base size
// (its size factor), the same order a sprint's cost is paid in (§3.3.1). Once its full size is under the smallest
// newborn's, `WILD_CELL_SIZE_FACTOR_MIN` × `worldMass`, it bursts through `dissolveCell` (detritus by the §1 rule, its
// engulfs aborted) and its seat respawns like an eaten one. No randomness: the same dish starves the same cell.

import { TICK_INTERVAL_S, type BalanceConfig, type RandomSource } from '@evolution/shared';
import { dissolveCell } from '../session/death.js';
import type { CellRecord, WildSeatRecord } from '../world/entities.js';
import { findCell } from '../world/lookups.js';
import type { WorldState } from '../world/world-state.js';
import type { WildSettleResult } from './wild-settle.js';

/** How much wild life the dish feeds at `worldMass`. */
export function wildCarryingCapacity(worldMass: number, balance: BalanceConfig): number {
  const { WILD_CELL_CARRYING_CAPACITY_MULTIPLE, WILD_CELL_COUNT } = balance.wildCells;
  return WILD_CELL_CARRYING_CAPACITY_MULTIPLE * WILD_CELL_COUNT * worldMass;
}

/** The seated seats with their cells, in seat order; a respawning seat is not among them (it weighs 0). */
function seatedCells(world: WorldState): { seat: WildSeatRecord; cell: CellRecord }[] {
  const seated: { seat: WildSeatRecord; cell: CellRecord }[] = [];
  for (const seat of world.wildSeats) {
    const cell = seat.cellId === null ? undefined : findCell(world, seat.cellId);
    if (cell !== undefined) {
      seated.push({ seat, cell });
    }
  }
  return seated;
}

/**
 * Step 1, before the settles: with no seat starving and the seated wild cells over the budget, the heaviest starts to
 * starve (the first in seat order on a tie).
 */
export function chooseWildStarver(world: WorldState, worldMass: number, balance: BalanceConfig): void {
  const seated = seatedCells(world);
  if (seated.some(({ seat }) => seat.isStarving)) {
    return;
  }
  const totalMass = seated.reduce((sum, { cell }) => sum + cell.mass, 0);
  if (totalMass <= wildCarryingCapacity(worldMass, balance)) {
    return;
  }
  let heaviest = seated[0];
  for (const candidate of seated) {
    if (heaviest === undefined || candidate.cell.mass > heaviest.cell.mass) {
      heaviest = candidate;
    }
  }
  if (heaviest !== undefined) {
    heaviest.seat.isStarving = true;
    heaviest.cell.starving = true;
  }
}

/** A starving settle's outcome: the settle's, one tick of starvation lighter, and the size factor it leaves. */
export interface StarvedSettle extends WildSettleResult {
  readonly sizeFactor: number;
}

/**
 * One tick of starvation on a settle (§3.3.6): `fullMass × fraction × tick` off the growth first, then off the base
 * size through the size factor; the wound the settle laid on stays as it was, relative to the smaller full size.
 */
export function starveSettled(
  settled: WildSettleResult,
  sizeFactor: number,
  worldMass: number,
  balance: BalanceConfig,
): StarvedSettle {
  const starvedMass = settled.fullMass * balance.wildCells.WILD_CELL_STARVATION_FRACTION_PER_SECOND * TICK_INTERVAL_S;
  const fromGrowth = Math.min(starvedMass, settled.grownMass);
  const nextSizeFactor = sizeFactor - (starvedMass - fromGrowth) / worldMass;
  const fullMass = settled.fullMass - starvedMass;
  const wound = settled.mass - settled.fullMass;
  const floor = Math.min(balance.growth.CELL_STARTING_MASS, nextSizeFactor * worldMass);
  return {
    mass: Math.max(floor, fullMass + wound),
    grownMass: settled.grownMass - fromGrowth,
    fullMass,
    sizeFactor: nextSizeFactor,
  };
}

/** A starving cell dies once its full size is under the smallest newborn's. */
export function isStarvedOut(fullMass: number, worldMass: number, balance: BalanceConfig): boolean {
  return fullMass < balance.wildCells.WILD_CELL_SIZE_FACTOR_MIN * worldMass;
}

/** The burst: the cell leaves the world with its scraps, and the seat stops starving (step 9 starts its respawn). */
export function burstStarvedCell(
  world: WorldState,
  seat: WildSeatRecord,
  cell: CellRecord,
  spawner: RandomSource,
): void {
  dissolveCell(world, cell, spawner);
  seat.isStarving = false;
}
