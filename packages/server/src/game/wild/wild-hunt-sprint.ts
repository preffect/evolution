// When a wild hunter's sprint pays off (docs/ecology/wild-cells.md §3.3.3, the #594 review): its cost is spent mass
// (the lead ruling on ticket #551), so a hunt sprint is taken only when it can land. Two tests, both on the shared
// numbers, no tunable of their own: the hunter still engulfs the prey at its mass after paying for the sprint, and the
// sprint reaches engulf contact within its duration. The second runs the shared movement kernel for the sprint's
// ticks exactly as step 3 would move the hunter (its speed cap at the paid mass, sprinting, its current velocity, the
// latched target at the prey's centre, the steer throttle easing off near it) against the prey carried on at its
// current velocity. A hunter that already covers the prey has no gap to close (the engulf starts at step 6 of this
// tick) and does not sprint.

import {
  TICK_INTERVAL_S,
  canEngulf,
  massAfterSprint,
  movementStepFor,
  sprintDurationTicks,
  stepMovementKernel,
  type BalanceConfig,
  type MovementPose,
} from '@evolution/shared';
import { massFloorOf } from '../simulation/cell-mass.js';
import { engulfContactGap, isEngulfContact } from '../simulation/contact.js';
import { movementStateOf } from '../simulation/movement.js';
import type { CellRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';

/** The hunter's mass once the sprint is paid, floored as `tryStartSprint` floors it. */
function massAfterHuntSprint(hunter: CellRecord, balance: BalanceConfig): number {
  return massAfterSprint(hunter.mass, balance, massFloorOf(hunter, hunter.mass, balance));
}

/** Where the prey is `ticks` ticks on if it keeps its current velocity, at its current size. */
function preyAhead(prey: CellRecord, ticks: number): CellRecord {
  const seconds = ticks * TICK_INTERVAL_S;
  return { ...prey, x: prey.x + prey.velocityX * seconds, y: prey.y + prey.velocityY * seconds };
}

/** The sprint, tick by tick through the shared kernel: does the hunter's membrane reach over the prey's centre? */
export function doesHuntSprintReachPrey(
  hunter: CellRecord,
  prey: CellRecord,
  world: WorldState,
  balance: BalanceConfig,
): boolean {
  const durationTicks = sprintDurationTicks(balance);
  const sprinting = {
    ...movementStateOf(hunter, world, balance),
    mass: massAfterHuntSprint(hunter, balance),
    sprintRemainingTicks: durationTicks,
  };
  const step = movementStepFor(sprinting, prey, balance);
  let pose: MovementPose = { x: hunter.x, y: hunter.y, velocityX: hunter.velocityX, velocityY: hunter.velocityY };
  for (let tick = 1; tick <= durationTicks; tick += 1) {
    pose = stepMovementKernel(pose, step);
    if (isEngulfContact({ ...pose, radius: hunter.radius }, preyAhead(prey, tick), balance)) {
      return true;
    }
  }
  return false;
}

/** A hunt sprint is worth its spent mass: the ratio holds after paying for it, and it reaches the prey in time. */
export function isHuntSprintWorthwhile(
  hunter: CellRecord,
  prey: CellRecord,
  world: WorldState,
  balance: BalanceConfig,
): boolean {
  return (
    canEngulf({ mass: massAfterHuntSprint(hunter, balance) }, prey, balance.absorption) &&
    engulfContactGap(hunter, prey, balance) > 0 &&
    doesHuntSprintReachPrey(hunter, prey, world, balance)
  );
}
