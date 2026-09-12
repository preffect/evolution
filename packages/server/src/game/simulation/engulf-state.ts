// The engulf record on a cell (docs/ECOLOGY.md §6.2, "two records, two homes"): the cell carries
// the simulation state, the player carries the lifecycle. `free` is the absence of both engulf
// states, so a released cell is a cell with nothing in `states`. Every mutation of that record
// goes through this file, so a state, an id, the progress and the carried offset can never be set
// half-way.

import {
  CELL_STATE,
  EFFECT_KIND,
  ENGULF_RELEASE_REASON,
  type CellState,
  type EngulfReleaseReason,
} from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';
import { findCell } from '../world/lookups.js';
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
  return prey.engulfedByCellId === null ? undefined : findCell(world, prey.engulfedByCellId);
}

/** The prey of `predator`, when it is engulfing one that is still in the world. */
export function engulfedPreyOf(world: WorldState, predator: CellRecord): CellRecord | undefined {
  return predator.engulfingCellId === null ? undefined : findCell(world, predator.engulfingCellId);
}

/**
 * A cell the world took out of an engulf this tick (docs/ECOLOGY.md §6.1 step 1, §6.3): the chain
 * payout, a removed predator, the results phase. It is left where its predator was — usually inside
 * the cell that just ate it — so it is unclaimable for the rest of the tick and gets one movement
 * step before anyone may start on it. Only `aborted` waits: a prey that escaped, was spat out or was
 * released on the ratio moved itself out and another predator may start on it at once
 * (§6.3, "spat out, still overlapping"). Without this the claim would fall to cell-id order — the
 * freed cell would be re-taken on the same tick whenever the top predator held the lower id.
 */
export function wasAbortedThisTick(cell: CellRecord, tick: number): boolean {
  return (
    cell.lastRelease !== null &&
    cell.lastRelease.reason === ENGULF_RELEASE_REASON.aborted &&
    cell.lastRelease.tick === tick
  );
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
export function releaseEngulf(world: WorldState, pairing: EngulfPairing, reason: EngulfReleaseReason): void {
  const { predator, prey } = pairing;
  clearEngulfRecords(pairing);
  prey.lastRelease = { reason, tick: world.tick, predatorCellId: predator.id };
  world.effects.push({
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

/**
 * Ends every engulf a cell is part of, as predator and as prey, with reason `aborted`: what a removed
 * cell does on its way out (a disconnect, `dissolveCell`) so no survivor is left holding or held by a
 * cell that is gone (docs/ECOLOGY.md §6.3). It lives here rather than in the step so `session/death.ts`
 * can reach it without importing the step, which imports the payout seam, which #259 points back at
 * `session/death.ts`.
 */
export function abortEngulfsOf(world: WorldState, cell: CellRecord): void {
  const predator = engulfingPredatorOf(world, cell);
  if (predator !== undefined) {
    releaseEngulf(world, { predator, prey: cell }, ENGULF_RELEASE_REASON.aborted);
  }
  const prey = engulfedPreyOf(world, cell);
  if (prey !== undefined) {
    releaseEngulf(world, { predator: cell, prey }, ENGULF_RELEASE_REASON.aborted);
  }
}

/** The round entering `results` aborts every engulf in the dish, with no payout (docs/ECOLOGY.md §6.3, E13). */
export function abortAllEngulfs(world: WorldState): void {
  for (const predator of [...world.cells]) {
    const prey = engulfedPreyOf(world, predator);
    if (prey !== undefined) {
      releaseEngulf(world, { predator, prey }, ENGULF_RELEASE_REASON.aborted);
    }
  }
}
