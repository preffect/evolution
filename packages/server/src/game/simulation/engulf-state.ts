// The engulf record on a cell (docs/ECOLOGY.md §6.2, "two records, two homes"): the cell carries
// the simulation state, the player carries the lifecycle. `free` is the absence of both engulf
// states, so a released cell is a cell with nothing in `states`. Every mutation of that record
// goes through this file, so a state, an id, the progress and the carried offset can never be set
// half-way.

import {
  CELL_STATE,
  EFFECT_KIND,
  secondsToTicks,
  type BalanceConfig,
  type CellState,
  type EngulfReleaseReason,
  type EntityId,
  type GameEffect,
} from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';

/** A predator holding its prey: the two records one running engulf spans. */
export interface EngulfPairing {
  readonly predator: CellRecord;
  readonly prey: CellRecord;
}

const NO_PROGRESS = 0;

function addState(cell: CellRecord, state: CellState): void {
  if (!cell.states.includes(state)) {
    cell.states.push(state);
  }
}

function removeState(cell: CellRecord, state: CellState): void {
  const index = cell.states.indexOf(state);
  if (index >= 0) {
    cell.states.splice(index, 1);
  }
}

/** The engulf this cell is the prey of, or `undefined`: a prey is claimed by at most one predator. */
export function engulfingPredatorOf(world: WorldState, prey: CellRecord): CellRecord | undefined {
  if (prey.engulfedByCellId === null) {
    return undefined;
  }
  return world.cells.find((cell) => cell.id === prey.engulfedByCellId);
}

/** True while `cell` is carried inside its predator (docs/ECOLOGY.md §6.1, from the seal on). */
export function isCarried(cell: CellRecord): boolean {
  return cell.carriedOffsetX !== null && cell.carriedOffsetY !== null;
}

/** Starts the engulf at progress 0; the same tick continues it (docs/ECOLOGY.md §6.1, step 1). */
export function beginEngulf(pairing: EngulfPairing): void {
  const { predator, prey } = pairing;
  predator.engulfingCellId = prey.id;
  addState(predator, CELL_STATE.engulfing);
  prey.engulfedByCellId = predator.id;
  prey.engulfProgress = NO_PROGRESS;
  addState(prey, CELL_STATE.beingEngulfed);
}

/**
 * The seal (docs/ECOLOGY.md §6.1): the offset is frozen and the prey's velocity zeroed, so from
 * the next movement step it rides the predator instead of steering.
 */
export function sealEngulf(pairing: EngulfPairing): void {
  const { predator, prey } = pairing;
  prey.carriedOffsetX = prey.x - predator.x;
  prey.carriedOffsetY = prey.y - predator.y;
  prey.velocityX = 0;
  prey.velocityY = 0;
}

/**
 * Ends an engulf with the prey alive: both cells free, progress 0, the prey left where it is (a
 * prey ejected after the seal therefore reappears at its carried offset, docs/ECOLOGY.md §6.3) and
 * one `cell_released` effect. The only path out of an engulf that is not the payout seam.
 */
export function releaseEngulf(
  world: WorldState,
  effects: GameEffect[],
  pairing: EngulfPairing,
  reason: EngulfReleaseReason,
): void {
  const { predator, prey } = pairing;
  clearEngulfRecords(pairing);
  effects.push({
    kind: EFFECT_KIND.cellReleased,
    tick: world.tick,
    x: prey.x,
    y: prey.y,
    cellId: prey.id,
    predatorCellId: predator.id,
    reason,
  });
}

/**
 * Both sides back to `free` with no effect: what a release and the payout seam (#259) share. The
 * prey keeps its centre, so one ejected after the seal stays at its carried offset.
 */
export function clearEngulfRecords(pairing: EngulfPairing): void {
  const { predator, prey } = pairing;
  predator.engulfingCellId = null;
  removeState(predator, CELL_STATE.engulfing);
  prey.engulfedByCellId = null;
  prey.engulfProgress = NO_PROGRESS;
  prey.carriedOffsetX = null;
  prey.carriedOffsetY = null;
  removeState(prey, CELL_STATE.beingEngulfed);
}

/** A live refractory blocks this predator from restarting on this prey (docs/ECOLOGY.md §6.1). */
export function hasSpitOutRefractory(predator: CellRecord, preyCellId: EntityId, tick: number): boolean {
  return predator.spitOutRefractories.some(
    (refractory) => refractory.preyCellId === preyCellId && refractory.untilTick >= tick,
  );
}

/** One entry per spat-out prey, so a predator that spits out X then Y within the second still remembers X. */
export function recordSpitOutRefractory(world: WorldState, pairing: EngulfPairing, balance: BalanceConfig): void {
  const untilTick = world.tick + secondsToTicks(balance.absorption.ENGULF_SPIT_OUT_REFRACTORY_SECONDS);
  const existing = pairing.predator.spitOutRefractories.find((refractory) => refractory.preyCellId === pairing.prey.id);
  if (existing === undefined) {
    pairing.predator.spitOutRefractories.push({ preyCellId: pairing.prey.id, untilTick });
    return;
  }
  existing.untilTick = untilTick;
}

/** Drops expired entries and entries for cells that have left the world, preserving order. */
export function pruneSpitOutRefractories(world: WorldState): void {
  for (const cell of world.cells) {
    if (cell.spitOutRefractories.length === 0) {
      continue;
    }
    cell.spitOutRefractories = cell.spitOutRefractories.filter(
      (refractory) =>
        refractory.untilTick >= world.tick && world.cells.some((other) => other.id === refractory.preyCellId),
    );
  }
}
