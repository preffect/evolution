// Drives a scenario the way the room loop does (docs/DETERMINISM.md §2): a `ManualClock` is
// advanced in bursts no larger than the accumulator's cap, `dueTicks()` says how many steps are
// owed, and every step runs the hooks around it. Wall time never enters; the clock is the test's.
// The tick count is the truth: the clock is positioned at the absolute time of the tick each
// burst ends on, never advanced by a fractional delta, so no float residue builds up across
// thousands of bursts (relative 83.33 ms advances over-step around tick 23 152 and drop a tick
// from 36 000 on); a burst that owes anything but its own length is a setup error, never a drift.

import {
  createSimulationStepAccumulator,
  ManualClock,
  MAX_TICKS_PER_ADVANCE,
  ticksToMilliseconds,
} from '@evolution/shared';
import { ScenarioSetupError } from './errors.js';

export interface TickHooks {
  /** Runs between tick `stepTick − 1` and tick `stepTick`: membership, fixtures, then inputs. */
  beforeStep(stepTick: number): void;
  /** Advances the module by exactly one tick. */
  step(): void;
  /** Runs once the state is at `tick`: checkpoints, captures and expectations. */
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
    clock.setMilliseconds(ticksToMilliseconds(tick + burstTicks));
    const dueTicks = accumulator.dueTicks();
    if (dueTicks !== burstTicks) {
      throw new ScenarioSetupError(
        `the accumulator owed ${dueTicks} ticks for a burst of ${burstTicks} at tick ${tick} ` +
          `(dropped ${accumulator.takeDroppedTicks()}): the tick driver has drifted from the clock`,
      );
    }
    for (let step = 0; step < dueTicks; step += 1) {
      tick += 1;
      hooks.beforeStep(tick);
      hooks.step();
      hooks.afterStep(tick);
    }
  }
}
