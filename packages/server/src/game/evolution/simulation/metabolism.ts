// Step 5 (docs/ECOLOGY.md §4, §4.1): one formula per cell, every term reading the masses at the
// start of the step. Base decay on the surplus above the starting mass (zone × trait
// multipliers), the toxin drains of overlapping or in-aura cells, then photosynthesis inside the
// shallows. The spike drain of a prey being engulfed joins with the engulf slice.

import { TICK_INTERVAL_S, ZONE_ID, distanceBetween, type BalanceConfig, type ZoneId } from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { loseMassToFloor, setCellMass } from './cell-mass.js';
import { zoneAt, zoneDecayMultiplier } from './zones.js';

/** The mass every term reads: the start-of-step snapshot, so the pair terms are order-independent. */
interface MetabolismInput {
  readonly cell: CellRecord;
  readonly massAtStart: number;
  readonly zone: ZoneId;
}

/** `max(0, mass − CELL_STARTING_MASS) × MASS_DECAY_RATE_PER_SECOND × zone × trait` (mass/s). */
export function decayPerSecond(input: MetabolismInput, balance: BalanceConfig): number {
  const surplus = Math.max(0, input.massAtStart - balance.growth.CELL_STARTING_MASS);
  return (
    surplus *
    balance.ecology.MASS_DECAY_RATE_PER_SECOND *
    zoneDecayMultiplier(input.zone, balance) *
    input.cell.modifiers.decayMultiplier
  );
}

/** A toxic cell reaches another by overlap, or by centre distance within its aura (docs/TRAITS.md §2). */
export function isReachedByToxin(target: CellRecord, toxic: CellRecord): boolean {
  const distance = distanceBetween(target, toxic);
  if (distance <= target.radius + toxic.radius) {
    return true;
  }
  return toxic.modifiers.toxinAuraRangeInRadii > 0 && distance <= toxic.modifiers.toxinAuraRangeInRadii * toxic.radius;
}

/** The summed toxin drain fraction per second of every other cell whose toxin reaches this one. */
export function toxinDrainFraction(target: CellRecord, cells: readonly CellRecord[]): number {
  let fraction = 0;
  for (const other of cells) {
    if (other !== target && other.modifiers.toxinDrainFractionPerSecond > 0 && isReachedByToxin(target, other)) {
      fraction += other.modifiers.toxinDrainFractionPerSecond;
    }
  }
  return fraction;
}

function metaboliseCell(input: MetabolismInput, inputs: readonly MetabolismInput[], balance: BalanceConfig): void {
  const { cell, massAtStart } = input;
  const drain =
    massAtStart *
    toxinDrainFraction(
      cell,
      inputs.map((other) => other.cell),
    ) *
    TICK_INTERVAL_S;
  const decayed = massAtStart - decayPerSecond(input, balance) * TICK_INTERVAL_S - drain;
  loseMassToFloor(cell, decayed, balance);
  if (input.zone === ZONE_ID.sunlitShallows && cell.modifiers.photosynthesisMassPerSecond > 0) {
    setCellMass(cell, cell.mass + cell.modifiers.photosynthesisMassPerSecond * TICK_INTERVAL_S, balance);
  }
}

export function metabolise(world: WorldState, context: StepContext): void {
  const inputs: MetabolismInput[] = world.cells.map((cell) => ({
    cell,
    massAtStart: cell.mass,
    zone: zoneAt(cell, world.gelPatches, context.balance),
  }));
  for (const input of inputs) {
    metaboliseCell(input, inputs, context.balance);
  }
}
