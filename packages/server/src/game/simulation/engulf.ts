// Step 6 (docs/ECOLOGY.md §6.1, §6.2, §6.3): the engulf lifecycle. Every pair of cells is walked
// id-sorted (docs/DETERMINISM.md §4), so "two predators reach one prey" resolves to the lower cell
// id without a tie-break of its own. Per pair, in the order §6.1 fixes: start, ratio, phase,
// spit-out, progress, then seal or payout. The formulas are shared and pure
// (`simulation/engulf-pace.ts`); the ratio and spit-out verdict is `resolveEngulfHold`; the record
// is `engulf-state.ts`; the completion is the #259 seam in `engulf-payout.ts`.

import {
  ENGULF_HOLD,
  ENGULF_PHASE,
  ENGULF_RELEASE_REASON,
  canContinueEngulf,
  canEngulf,
  engulfPhaseOf,
  engulfProgressDelta,
  resolveEngulfHold,
  type BalanceConfig,
  type EngulfPhase,
} from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { cellPairs, isEngulfContact, type CellPair } from './contact.js';
import { payOutEngulf } from './engulf-payout.js';
import {
  hasSpitOutRefractory,
  noSpitOutDraw,
  pruneSpitOutRefractories,
  recordSpitOutRefractory,
  spitOutDrawFor,
} from './engulf-spit-out.js';
import { beginEngulf, releaseEngulf, sealEngulf, wasAbortedThisTick, type EngulfPairing } from './engulf-state.js';

/** Progress pays out at `1 − ENGULF_PROGRESS_EPSILON`, so thirty-six additions of 1/36 finish on tick 36. */
const COMPLETE_PROGRESS = 1;
/** The prey's steering projected away from the predator never counts as help. */
const NO_AWAY_EFFORT = 0;
/**
 * The prey's struggle this tick (docs/ECOLOGY.md §6.1): the steer command the movement step took at
 * the start of this tick and moved on (`CellRecord.steerCommand`, taken once in `movement.ts`),
 * projected onto the line away from the predator. Reading the stored command rather than taking a
 * second one here is what makes "the same direction and throttle the movement step used" true: the
 * centres have already moved by the time this runs.
 */
export function awayEffortOf(predator: CellRecord, prey: CellRecord): number {
  const offsetX = prey.x - predator.x;
  const offsetY = prey.y - predator.y;
  const distance = Math.hypot(offsetX, offsetY);
  if (distance === 0) {
    return NO_AWAY_EFFORT;
  }
  const away = (prey.steerCommand.directionX * offsetX + prey.steerCommand.directionY * offsetY) / distance;
  return prey.steerCommand.throttle * Math.max(NO_AWAY_EFFORT, away);
}

/**
 * Can `predator` claim `prey` this tick: neither is already engaged, mass, contact, no refractory,
 * and the prey was not freed by an abort this tick (docs/ECOLOGY.md §6.3, the chain row: a cell the
 * world dropped inside its next predator may be started on "next tick", never on this one).
 */
export function canStartEngulf(
  predator: CellRecord,
  prey: CellRecord,
  world: WorldState,
  balance: BalanceConfig,
): boolean {
  return (
    predator.engulfingCellId === null &&
    prey.engulfedByCellId === null &&
    canEngulf(predator, prey, balance.absorption) &&
    !wasAbortedThisTick(prey, world.tick) &&
    !hasSpitOutRefractory(predator, prey.id, world.tick) &&
    isEngulfContact(predator, prey, balance)
  );
}

/** The engulf already running between the two cells of a pair, in either direction. */
function runningEngulfIn(pair: CellPair): EngulfPairing | undefined {
  if (pair.lower.engulfingCellId === pair.higher.id) {
    return { predator: pair.lower, prey: pair.higher };
  }
  if (pair.higher.engulfingCellId === pair.lower.id) {
    return { predator: pair.higher, prey: pair.lower };
  }
  return undefined;
}

/** Step 1: the lower id is offered the prey first, which is the §6.3 tie-break. */
function startEngulfIn(pair: CellPair, world: WorldState, context: StepContext): EngulfPairing | undefined {
  const candidates: EngulfPairing[] = [
    { predator: pair.lower, prey: pair.higher },
    { predator: pair.higher, prey: pair.lower },
  ];
  for (const pairing of candidates) {
    if (canStartEngulf(pairing.predator, pairing.prey, world, context.balance)) {
      beginEngulf(pairing);
      return pairing;
    }
  }
  return undefined;
}

/** Steps 2 and 4: the ratio, then the spit-out that only a hold surviving the ratio ever draws for. */
function resolveHold(pairing: EngulfPairing, phase: EngulfPhase, world: WorldState, context: StepContext): boolean {
  const absorption = context.balance.absorption;
  const { predator, prey } = pairing;
  // The draw is guarded by the ratio so a prey released on step 2 never advances the stream.
  const draw = canContinueEngulf(predator, prey, absorption)
    ? spitOutDrawFor(prey, phase, context)
    : noSpitOutDraw(phase);
  const verdict = resolveEngulfHold(predator, prey, draw, absorption);
  if (verdict === ENGULF_HOLD) {
    return true;
  }
  if (verdict === ENGULF_RELEASE_REASON.spatOut) {
    recordSpitOutRefractory(world, pairing, context.balance);
  }
  releaseEngulf(world, pairing, verdict);
  return false;
}

/** Steps 5 and 6: progress, then the escape, the seal or the payout the new progress implies. */
function advanceProgress(pairing: EngulfPairing, phase: EngulfPhase, world: WorldState, context: StepContext): void {
  const absorption = context.balance.absorption;
  const { predator, prey } = pairing;
  const isSealed = phase === ENGULF_PHASE.absorb;
  const isInContact = isSealed || isEngulfContact(predator, prey, context.balance);
  if (phase === ENGULF_PHASE.cover && !isInContact) {
    releaseEngulf(world, pairing, ENGULF_RELEASE_REASON.escaped);
    return;
  }
  prey.engulfProgress += engulfProgressDelta(
    {
      phase,
      predatorMass: predator.mass,
      preyMass: prey.mass,
      isInContact,
      awayEffort: isSealed ? NO_AWAY_EFFORT : awayEffortOf(predator, prey),
      predator: predator.modifiers,
      prey: prey.modifiers,
    },
    absorption,
  );
  if (!isInContact) {
    // The grip is gone the moment the decayed progress falls back into the cover band.
    if (engulfPhaseOf(prey.engulfProgress, absorption) === ENGULF_PHASE.cover) {
      releaseEngulf(world, pairing, ENGULF_RELEASE_REASON.escaped);
    }
    return;
  }
  if (prey.engulfProgress >= COMPLETE_PROGRESS - absorption.ENGULF_PROGRESS_EPSILON) {
    payOutEngulf(world, context, pairing);
    return;
  }
  if (!isSealed && engulfPhaseOf(prey.engulfProgress, absorption) === ENGULF_PHASE.absorb) {
    sealEngulf(pairing);
  }
}

/** One pair of cells, in the order docs/ECOLOGY.md §6.1 fixes; a start continues on the same tick. */
function stepEngulfPair(pair: CellPair, world: WorldState, context: StepContext): void {
  const pairing = runningEngulfIn(pair) ?? startEngulfIn(pair, world, context);
  if (pairing === undefined) {
    return;
  }
  const phase = engulfPhaseOf(pairing.prey.engulfProgress, context.balance.absorption);
  if (resolveHold(pairing, phase, world, context)) {
    advanceProgress(pairing, phase, world, context);
  }
}

/**
 * Both cells of a pair are still in the world. The pair list is taken once per step, so a pair taken
 * before a cell left is stale: from #259 on the payout removes the prey, and a stale pair would let a
 * later predator claim a cell that has gone. `canStartEngulf` cannot catch that — the payout clears
 * `engulfedByCellId`, so the removed cell looks free — and the pair never appears again, so nothing
 * would ever release the predator from `engulfing` a ghost.
 */
export function isPairInWorld(pair: CellPair, world: WorldState): boolean {
  return world.cells.includes(pair.lower) && world.cells.includes(pair.higher);
}

/** Step 6 of the tick. */
export function runEngulfs(world: WorldState, context: StepContext): void {
  pruneSpitOutRefractories(world);
  for (const pair of cellPairs(world.cells)) {
    if (isPairInWorld(pair, world)) {
      stepEngulfPair(pair, world, context);
    }
  }
}
