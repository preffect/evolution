// The spit-out half of the engulf (docs/ECOLOGY.md §6.1, "Spit-out"): the per-tick roll a spiny prey
// makes from the `engulf` stream, and the refractory its predator keeps afterwards. Two readers of
// that refractory, both here: the engulf step's start check and its prune at step 6, and separation
// at step 3 through `contact.ts`, which treats a pair inside one as a pair that cannot engulf (§5.3).
//
// No build-1 tier table sets `spitOutChancePerSecond` yet — the Diatom Shell's 0.4 / 0.7 / 1.0 arrives
// with #260 (docs/TRAITS.md §3.15) — so in play today every prey takes the no-draw branch and the
// stream is never advanced. The path itself is live: a folded modifier with a positive chance runs it,
// which is how `engulf-spit-out.test.ts` reaches it.

import {
  ENGULF_PHASE,
  RANDOM_STREAM,
  secondsToTicks,
  spitOutChancePerTick,
  type BalanceConfig,
  type EngulfPhase,
  type EngulfSpitOutDraw,
  type EntityId,
} from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';
import { findCell } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import type { EngulfPairing } from './engulf-state.js';

/** A prey with no spines never rolls: chance 0, no draw, and the `engulf` stream is not advanced. */
const NO_SPIT_OUT_CHANCE_PER_SECOND = 0;
const NO_SPIT_OUT_CHANCE_PER_TICK = 0;

/** The draw of a tick where no roll was made, for a prey with no chance or a hold already lost. */
export function noSpitOutDraw(phase: EngulfPhase): EngulfSpitOutDraw {
  return { phase, spitOutRoll: null, spitOutChancePerTick: NO_SPIT_OUT_CHANCE_PER_TICK };
}

/**
 * This tick's spit-out draw. The `engulf` stream is touched only for a wrapped or sealed prey whose
 * chance is positive, so a dish without spiny cells never advances it (docs/DETERMINISM.md §3) and
 * the roll is `null` when no draw was made.
 */
export function spitOutDrawFor(prey: CellRecord, phase: EngulfPhase, context: StepContext): EngulfSpitOutDraw {
  const chancePerSecond = prey.modifiers.spitOutChancePerSecond;
  if (phase === ENGULF_PHASE.cover || chancePerSecond <= NO_SPIT_OUT_CHANCE_PER_SECOND) {
    return noSpitOutDraw(phase);
  }
  return {
    phase,
    spitOutRoll: context.streams[RANDOM_STREAM.engulf].nextFloat(),
    spitOutChancePerTick: spitOutChancePerTick(chancePerSecond),
  };
}

/**
 * `untilTick` is the last tick still blocked. A refractory recorded on tick T (the tick the prey was
 * spat out, whose engulf step has already run, so no restart was possible on it anyway) has
 * `untilTick` = T + `secondsToTicks(ENGULF_SPIT_OUT_REFRACTORY_SECONDS)` and lapses on the tick after
 * that: with 1.0 s the predator is refused on the sixty ticks T + 1 … T + 60 and starts again on
 * T + 61. Sixty refused ticks is exactly the constant's second.
 */
function hasLapsed(untilTick: number, tick: number): boolean {
  return tick > untilTick;
}

/** A live refractory blocks this predator from restarting on this prey (docs/ECOLOGY.md §6.1). */
export function hasSpitOutRefractory(predator: CellRecord, preyCellId: EntityId, tick: number): boolean {
  return predator.spitOutRefractories.some(
    (refractory) => refractory.preyCellId === preyCellId && !hasLapsed(refractory.untilTick, tick),
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
        !hasLapsed(refractory.untilTick, world.tick) && findCell(world, refractory.preyCellId) !== undefined,
    );
  }
}
