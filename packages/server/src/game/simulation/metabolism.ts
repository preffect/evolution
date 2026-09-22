// Step 5 (docs/ecology/mass-and-movement.md §4, §4.1): one formula per cell, every term reading the masses and
// radii at the start of the step, so the pair terms are order-independent. Base decay on the
// surplus above the starting mass (zone × trait multipliers), the toxin drains of overlapping or
// in-aura cells plus what an engulfed prey's spikes and swallowed toxin cost its predator
// (`engulf-drain.ts`), then photosynthesis inside the shallows. What each player cell was applied, by cause, goes to
// `world.massFlow` (`metabolism-flow.ts`, #383). A free wild cell is skipped (it neither eats nor decays: the pin
// re-sets it every tick); an engulfing one bleeds like any predator and what it loses is booked against its seat
// (docs/ecology/wild-cells.md §3.3 "Bleeding while engulfing").

import {
  TICK_INTERVAL_S,
  ZONE_ID,
  distanceBetween,
  zoneAt,
  zoneDecayMultiplier,
  type BalanceConfig,
  type CellModifiers,
  type EntityId,
  type ZoneId,
} from '@evolution/shared';
import { isPlayerCell, type CellRecord } from '../world/entities.js';
import { requirePlayer } from '../world/lookups.js';
import { beginMetabolismRecords, recordMetabolism } from '../world/mass-flow-ledger.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { recordWildDrain } from '../wild/wild-pin.js';
import { gainMass, loseMassToFloor } from './cell-mass.js';
import { engulfDrainOf } from './engulf-drain.js';
import { isEngulfing } from './engulf-state.js';
import { massFlowRecordOf, type MetabolismDemand } from './metabolism-flow.js';

/** What the toxin reach reads of a cell: its centre, a radius and its modifiers. A record satisfies it; the step passes start-of-step views. */
export interface ToxinReachView {
  readonly id: EntityId;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly modifiers: CellModifiers;
}

/** The start-of-step snapshot every term reads. */
export interface MetabolismInput {
  readonly cell: CellRecord;
  readonly massAtStart: number;
  /** The reach view over the start-of-step radius: a cell decayed earlier in the loop keeps its reach. */
  readonly reach: ToxinReachView;
  readonly zone: ZoneId;
}

export function metabolismInputOf(cell: CellRecord, world: WorldState, balance: BalanceConfig): MetabolismInput {
  return {
    cell,
    massAtStart: cell.mass,
    reach: { id: cell.id, x: cell.x, y: cell.y, radius: cell.radius, modifiers: cell.modifiers },
    zone: zoneAt(cell, world.gelPatches, balance),
  };
}

/**
 * The broth share of decay, `max(0, mass − CELL_STARTING_MASS) × MASS_DECAY_RATE_PER_SECOND × trait` (mass/s), from
 * its own factors: what the snapshot reports as `decay`, with the vent's extra as `× (VENT_DECAY_MULTIPLIER − 1)`
 * (#383). `decayPerSecond` keeps its own operand order, so the mass arithmetic and the hash stay bit-identical.
 */
export function brothDecayPerSecond(input: MetabolismInput, balance: BalanceConfig): number {
  const surplus = Math.max(0, input.massAtStart - balance.growth.CELL_STARTING_MASS);
  return surplus * balance.ecology.MASS_DECAY_RATE_PER_SECOND * input.cell.modifiers.decayMultiplier;
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

/**
 * The farthest centre distance at which a toxic cell's toxin reaches a target of `targetRadius`: contact, plus
 * `toxinAuraRangeInRadii` of the toxic cell's radii measured from its rim (docs/traits/model.md §2, #424). Without an
 * aura this is exactly the contact distance.
 */
export function toxinReachDistance(targetRadius: number, toxic: ToxinReachView): number {
  return targetRadius + toxic.radius * (1 + toxic.modifiers.toxinAuraRangeInRadii);
}

/** A toxic cell reaches another by overlap, or without contact within its aura beyond the rim. */
export function isReachedByToxin(target: ToxinReachView, toxic: ToxinReachView): boolean {
  return distanceBetween(target, toxic) <= toxinReachDistance(target.radius, toxic);
}

/**
 * The summed toxin drain fraction per second of every other cell whose toxin reaches this one, less
 * `swallowedCellId`: a prey past cover counts swallowed instead (`engulfDrainOf`), never both ways.
 */
export function toxinDrainFraction(
  target: ToxinReachView,
  cells: readonly ToxinReachView[],
  swallowedCellId: EntityId | null = null,
): number {
  let fraction = 0;
  for (const other of cells) {
    const isCounted = other.id !== target.id && other.id !== swallowedCellId;
    if (isCounted && other.modifiers.toxinDrainFractionPerSecond > 0 && isReachedByToxin(target, other)) {
      fraction += other.modifiers.toxinDrainFractionPerSecond;
    }
  }
  return fraction;
}

/**
 * The light gain goes through the cap (§5.4): its overflow is the owner's DNA. The owner is looked up only for a
 * cell that photosynthesises, so the other cells pay no players scan.
 */
function photosynthesise(input: MetabolismInput, world: WorldState, balance: BalanceConfig): void {
  const { cell } = input;
  if (input.zone === ZONE_ID.sunlitShallows && cell.modifiers.photosynthesisMassPerSecond > 0) {
    const owner = isPlayerCell(cell) ? requirePlayer(world, cell.playerId) : undefined;
    gainMass(cell, owner, cell.modifiers.photosynthesisMassPerSecond * TICK_INTERVAL_S, balance);
  }
}

/** The requested losses by cause (mass/s): the vent's extra is the broth share × (the zone multiplier − 1). */
function metabolismDemandOf(
  input: MetabolismInput,
  drains: MetabolismDrains,
  balance: BalanceConfig,
): MetabolismDemand {
  const brothDecay = brothDecayPerSecond(input, balance);
  return {
    toxin: input.massAtStart * drains.contactFraction,
    swallowed: drains.swallowedDosePerSecond,
    decay: brothDecay,
    vent: brothDecay * (zoneDecayMultiplier(input.zone, balance) - 1),
  };
}

/** What one cell's formula asks for this tick, before the floor. */
interface MetabolismDrains {
  readonly decayPerSecond: number;
  readonly contactFraction: number;
  readonly swallowedDosePerSecond: number;
}

/**
 * Decay and drains floor first, then the light. A player cell's applied amounts, by cause, are recorded beside the
 * effects (#383); the mass arithmetic is the formula's and never reads the record. A wild cell's loss goes to its
 * seat's `drainedMass` instead.
 */
function metaboliseCell(
  input: MetabolismInput,
  step: MetabolismStepView,
  world: WorldState,
  balance: BalanceConfig,
): void {
  const { cell, massAtStart } = input;
  const engulfDrain = engulfDrainOf(cell, world, step.massesAtStart, balance);
  const drains: MetabolismDrains = {
    decayPerSecond: decayPerSecond(input, balance),
    contactFraction: toxinDrainFraction(input.reach, step.reaches, engulfDrain.swallowedCellId),
    swallowedDosePerSecond: engulfDrain.doseMassPerSecond,
  };
  const drain = (massAtStart * drains.contactFraction + drains.swallowedDosePerSecond) * TICK_INTERVAL_S;
  loseMassToFloor(cell, massAtStart - drains.decayPerSecond * TICK_INTERVAL_S - drain, balance);
  const massAfterFloor = cell.mass;
  photosynthesise(input, world, balance);
  if (!isPlayerCell(cell)) {
    recordWildDrain(world, cell, massAtStart - massAfterFloor);
    return;
  }
  const demand = metabolismDemandOf(input, drains, balance);
  const measure = { demand, massAtStart, massAfterFloor, massAfterGain: cell.mass, zone: input.zone };
  const record = massFlowRecordOf({ ...measure, decayMultiplier: cell.modifiers.decayMultiplier });
  recordMetabolism(world.massFlow, cell.playerId, record);
}

/** A free wild cell is the world's average, re-pinned in full at step 1: nothing to apply. */
function isMetabolised(cell: CellRecord): boolean {
  return isPlayerCell(cell) || isEngulfing(cell);
}

/** What every cell's formula reads of the others at the start of the step. */
interface MetabolismStepView {
  readonly reaches: readonly ToxinReachView[];
  readonly massesAtStart: ReadonlyMap<EntityId, number>;
}

export function metabolise(world: WorldState, context: StepContext): void {
  beginMetabolismRecords(world.massFlow);
  const inputs = world.cells.map((cell) => metabolismInputOf(cell, world, context.balance));
  const step: MetabolismStepView = {
    reaches: inputs.map((input) => input.reach),
    massesAtStart: new Map(inputs.map((input) => [input.cell.id, input.massAtStart])),
  };
  for (const input of inputs) {
    if (isMetabolised(input.cell)) {
      metaboliseCell(input, step, world, context.balance);
    }
  }
}
