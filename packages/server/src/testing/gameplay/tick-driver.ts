// Drives a scenario the way the room loop does (docs/DETERMINISM.md §2): a `ManualClock` is
// advanced in bursts no larger than the accumulator's cap, `dueTicks()` says how many steps are
// owed, and every step runs the hooks around it. Wall time never enters; the clock is the test's.

import {
  createSimulationStepAccumulator,
  ManualClock,
  MAX_TICKS_PER_ADVANCE,
  ticksToMilliseconds,
} from '@evolution/shared';
import { ScenarioSetupError } from './errors.js';

export interface TickHooks {
  /** Runs between tick `stepTick − 1` and tick `stepTick`: membership, then inputs. */
  beforeStep(stepTick: number): void;
  /** Advances the module by exactly one tick. */
  step(): void;
  /** Runs once the state is at `tick`: checkpoints and expectations. */
  afterStep(tick: number): void;
}

/** Steps from tick 0 to `totalTicks` under a manual clock and the production accumulator. */
export function driveTicks(totalTicks: number, hooks: TickHooks): void {
  if (!Number.isInteger(totalTicks) || totalTicks < 0) {
    throw new ScenarioSetupError(`a scenario runs a non-negative whole number of ticks, got ${totalTicks}`);
  }
  const clock = new ManualClock();
  const accumulator = createSimulationStepAccumulator(clock);
  let tick = 0;
  while (tick < totalTicks) {
    const burstTicks = Math.min(MAX_TICKS_PER_ADVANCE, totalTicks - tick);
    clock.advanceMilliseconds(ticksToMilliseconds(burstTicks));
    for (let due = accumulator.dueTicks(); due > 0; due -= 1) {
      tick += 1;
      hooks.beforeStep(tick);
      hooks.step();
      hooks.afterStep(tick);
    }
  }
  const dropped = accumulator.takeDroppedTicks();
  if (dropped > 0 || tick !== totalTicks) {
    throw new ScenarioSetupError(`the accumulator dropped ${dropped} ticks and stopped at ${tick} of ${totalTicks}`);
  }
}
