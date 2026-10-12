// Step 1's giant settle (docs/ecology/giants.md §3.5.3, §3.5.10): after the wild settle, in seat order, each seated
// giant's mass is laid on its full size by the wild settle's own core, with the born mass for the base size, the fixed
// `GIANT_MASS_CEILING` for the growth ceiling and the player's decay × `GIANT_DECAY_MULTIPLIER` taken from the growth.
// Then its fixed build is laid on again (`applyGiantBuild`, the speed multiplier's one home). A giant is outside the
// die-off: the giant seats are not among the wild seats the die-off sums, and nothing here ever starves one.

import type { BalanceConfig } from '@evolution/shared';
import { setCellMass } from '../simulation/cell-mass.js';
import { decayPerSecond, metabolismInputOf } from '../simulation/metabolism.js';
import type { CellRecord, GiantSeatRecord } from '../world/entities.js';
import { seatedGiantCells } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { applyGiantBuild } from './giant-build.js';
import { settleWildMass } from './wild-settle.js';

/** §4's decay of the giant's cell at its mass, zone and trait multipliers included, × `GIANT_DECAY_MULTIPLIER`. */
export function giantDecayPerSecond(cell: CellRecord, world: WorldState, balance: BalanceConfig): number {
  return decayPerSecond(metabolismInputOf(cell, world, balance), balance) * balance.giants.GIANT_DECAY_MULTIPLIER;
}

/** Settles one giant: its mass on the new full size, the seat's growth and full size, and its build. */
export function settleGiantCell(
  world: WorldState,
  seat: GiantSeatRecord,
  cell: CellRecord,
  balance: BalanceConfig,
): void {
  const settled = settleWildMass(
    {
      mass: cell.mass,
      fullMass: seat.fullMass,
      grownMass: seat.grownMass,
      decayPerSecond: giantDecayPerSecond(cell, world, balance),
      baseMass: seat.bornMass,
      growthCeiling: balance.giants.GIANT_MASS_CEILING,
    },
    balance,
  );
  seat.grownMass = settled.grownMass;
  seat.fullMass = settled.fullMass;
  setCellMass(cell, settled.mass, balance);
  applyGiantBuild(cell, seat.species, balance);
}

/** Step 1 for the giant seats, after the wild settle: every seated giant settled, in seat order. */
export function settleGiantCells(world: WorldState, context: StepContext): void {
  for (const { seat, cell } of seatedGiantCells(world)) {
    settleGiantCell(world, seat, cell, context.balance);
  }
}
