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
  RANDOM_STREAM,
  canContinueEngulf,
  canEngulf,
  engulfPhaseOf,
  engulfPredatorPaceModifiersOf,
  engulfPreyPaceModifiersOf,
  engulfProgressDelta,
  resolveEngulfHold,
  spitOutChancePerTick,
  steerCommand,
  type BalanceConfig,
  type EngulfPhase,
  type EngulfSpitOutDraw,
} from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { cellPairs, isEngulfContact, type CellPair } from './contact.js';
import { payOutEngulf } from './engulf-payout.js';
import {
  beginEngulf,
  engulfingPredatorOf,
  hasSpitOutRefractory,
  pruneSpitOutRefractories,
  recordSpitOutRefractory,
  releaseEngulf,
  sealEngulf,
  type EngulfPairing,
} from './engulf-state.js';

/** Progress pays out at `1 − ENGULF_PROGRESS_EPSILON`, so thirty-six additions of 1/36 finish on tick 36. */
const COMPLETE_PROGRESS = 1;
/** The prey's steering projected away from the predator never counts as help. */
const NO_AWAY_EFFORT = 0;
/** A prey with no spines never rolls: chance 0, no draw (docs/DETERMINISM.md §3). */
const NO_SPIT_OUT_CHANCE_PER_TICK = 0;

/** The draw of a tick where no roll was made, for a prey with no chance or a hold already lost. */
function noSpitOutDraw(phase: EngulfPhase): EngulfSpitOutDraw {
  return { phase, spitOutRoll: null, spitOutChancePerTick: NO_SPIT_OUT_CHANCE_PER_TICK };
}

/**
 * The prey's struggle this tick: its own steer command (the one the movement step used, through
 * the shared kernel) projected onto the line away from the predator (docs/ECOLOGY.md §6.1).
 */
export function awayEffortOf(predator: CellRecord, prey: CellRecord, balance: BalanceConfig): number {
  const offsetX = prey.x - predator.x;
  const offsetY = prey.y - predator.y;
  const distance = Math.hypot(offsetX, offsetY);
  if (distance === 0) {
    return NO_AWAY_EFFORT;
  }
  const command = steerCommand(prey, {
    targetX: prey.targetX,
    targetY: prey.targetY,
    radiusWu: prey.radius,
    controls: balance.controls,
  });
  const away = (command.directionX * offsetX + command.directionY * offsetY) / distance;
  return command.throttle * Math.max(NO_AWAY_EFFORT, away);
}

/**
 * This tick's spit-out draw. The `engulf` stream is touched only for a wrapped or sealed prey
 * whose chance is positive, so a dish without spiny cells never advances it
 * (docs/DETERMINISM.md §3) and the roll is `null` when no draw was made.
 */
function spitOutDrawFor(prey: CellRecord, phase: EngulfPhase, context: StepContext): EngulfSpitOutDraw {
  const chancePerSecond = engulfPreyPaceModifiersOf(prey.modifiers).spitOutChancePerSecond;
  const spitOutChance = spitOutChancePerTick(chancePerSecond);
  if (phase === ENGULF_PHASE.cover || chancePerSecond <= NO_SPIT_OUT_CHANCE_PER_TICK) {
    return noSpitOutDraw(phase);
  }
  return {
    phase,
    spitOutRoll: context.streams[RANDOM_STREAM.engulf].nextFloat(),
    spitOutChancePerTick: spitOutChance,
  };
}

/** Can `predator` claim `prey` this tick: neither is already engaged, mass, contact and no refractory. */
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
  releaseEngulf(world, context.effects, pairing, verdict);
  return false;
}

/** Steps 5 and 6: progress, then the escape, the seal or the payout the new progress implies. */
function advanceProgress(pairing: EngulfPairing, phase: EngulfPhase, world: WorldState, context: StepContext): void {
  const absorption = context.balance.absorption;
  const { predator, prey } = pairing;
  const isSealed = phase === ENGULF_PHASE.absorb;
  const isInContact = isSealed || isEngulfContact(predator, prey, context.balance);
  if (phase === ENGULF_PHASE.cover && !isInContact) {
    releaseEngulf(world, context.effects, pairing, ENGULF_RELEASE_REASON.escaped);
    return;
  }
  prey.engulfProgress += engulfProgressDelta(
    {
      phase,
      predatorMass: predator.mass,
      preyMass: prey.mass,
      isInContact,
      awayEffort: isSealed ? NO_AWAY_EFFORT : awayEffortOf(predator, prey, context.balance),
      predator: engulfPredatorPaceModifiersOf(predator.modifiers),
      prey: engulfPreyPaceModifiersOf(prey.modifiers),
    },
    absorption,
  );
  if (!isInContact) {
    if (prey.engulfProgress < absorption.ENGULF_WRAP_START_PROGRESS - absorption.ENGULF_PROGRESS_EPSILON) {
      releaseEngulf(world, context.effects, pairing, ENGULF_RELEASE_REASON.escaped);
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

/** Step 6 of the tick. */
export function runEngulfs(world: WorldState, context: StepContext): void {
  pruneSpitOutRefractories(world);
  for (const pair of cellPairs(world.cells)) {
    stepEngulfPair(pair, world, context);
  }
}

/** The prey of `predator`, when it is engulfing one that is still in the world. */
function preyOf(world: WorldState, predator: CellRecord): CellRecord | undefined {
  if (predator.engulfingCellId === null) {
    return undefined;
  }
  return world.cells.find((cell) => cell.id === predator.engulfingCellId);
}

/**
 * Ends every engulf a cell is part of, as predator and as prey, with reason `aborted`: what a
 * removed cell does on its way out (a disconnect, `dissolveCell`) so no survivor is left holding
 * or held by a cell that is gone (docs/ECOLOGY.md §6.3).
 */
export function abortEngulfsOf(world: WorldState, cell: CellRecord): void {
  const predator = engulfingPredatorOf(world, cell);
  if (predator !== undefined) {
    releaseEngulf(world, world.effects, { predator, prey: cell }, ENGULF_RELEASE_REASON.aborted);
  }
  const prey = preyOf(world, cell);
  if (prey !== undefined) {
    releaseEngulf(world, world.effects, { predator: cell, prey }, ENGULF_RELEASE_REASON.aborted);
  }
}

/** The round entering `results` aborts every engulf in the dish, with no payout (docs/ECOLOGY.md §6.3, E13). */
export function abortAllEngulfs(world: WorldState): void {
  for (const predator of [...world.cells]) {
    const prey = preyOf(world, predator);
    if (prey !== undefined) {
      releaseEngulf(world, world.effects, { predator, prey }, ENGULF_RELEASE_REASON.aborted);
    }
  }
}
