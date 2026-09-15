// The dose a predator pays for the prey it is engulfing (docs/ecology/mass-and-movement.md §4.1 `swallowedDose`,
// docs/ecology/absorption.md §6.1 "Swallowed toxin", #154): read against the PREY's start-of-step mass, the
// prey's spikes while progress > 0 and its toxin × `ENGULF_SWALLOWED_TOXIN_MULTIPLIER` once the engulf is past
// cover. The metabolism step (5) reads the engulf state the previous tick's engulf step (6) left, so a
// predator that starts on tick t first pays on tick t + 1, and the swallowed toxin begins the tick after the
// progress enters the wrap band.

import { ENGULF_PHASE, engulfPhaseOf, type BalanceConfig, type EntityId } from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';
import { engulfedPreyOf } from './engulf-state.js';

/** An engulf that has not advanced yet costs the predator nothing. */
const NO_PROGRESS = 0;

export interface EngulfDrain {
  /** The prey whose toxin is swallowed, so the contact toxin sum does not count it a second time. */
  readonly swallowedCellId: EntityId | null;
  /** Mass the predator loses per second to that prey (absolute, not a share of its own mass). */
  readonly doseMassPerSecond: number;
}

const NO_ENGULF_DRAIN: EngulfDrain = { swallowedCellId: null, doseMassPerSecond: 0 };

/** What `predator` pays this tick for the prey it holds; `massesAtStart` are the step's start-of-step masses. */
export function engulfDrainOf(
  predator: CellRecord,
  world: WorldState,
  massesAtStart: ReadonlyMap<EntityId, number>,
  balance: BalanceConfig,
): EngulfDrain {
  const prey = engulfedPreyOf(world, predator);
  if (prey === undefined || prey.engulfProgress <= NO_PROGRESS) {
    return NO_ENGULF_DRAIN;
  }
  // A prey that is not in this step's masses joined the world after it began, so it has nothing to give yet.
  const preyMass = massesAtStart.get(prey.id);
  if (preyMass === undefined) {
    return NO_ENGULF_DRAIN;
  }
  const spikes = preyMass * prey.modifiers.spikeDrainFractionPerSecond;
  if (engulfPhaseOf(prey.engulfProgress, balance.absorption) === ENGULF_PHASE.cover) {
    return { swallowedCellId: null, doseMassPerSecond: spikes };
  }
  const swallowedToxin =
    preyMass * prey.modifiers.toxinDrainFractionPerSecond * balance.absorption.ENGULF_SWALLOWED_TOXIN_MULTIPLIER;
  return { swallowedCellId: prey.id, doseMassPerSecond: spikes + swallowedToxin };
}
