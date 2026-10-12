// Step 1 for the seats' minds (docs/ecology/wild-cells.md §3.3.3, docs/ecology/giants.md §3.5.5–§3.5.7,
// docs/architecture/server-simulation.md §3.4): after the settles, every seat whose countdown ran out decides by its
// profile (`seat-profile.ts`, `seat-decision.ts`): the wild seats first, then the giant seats, in seat order. It
// latches the target on its cell exactly as a player's input is latched, so step 3 moves it through the shared kernel,
// may start a sprint, and a hunt's aim is re-resolved every tick from the prey's current place and the contact
// (`wild-hunt-aim.ts`, #738).
//
// A sprint is the player's own (`tryStartSprint`: cooldown, duration and a cost floored at `massFloorOf`), started
// only on a decision and never while engulfing or carried. Its cost comes off the growth first, spent for good like a
// player's; whatever it takes below the base size is a wound the settle recovers (the lead's ruling on the #594
// review), so a fat cell pays for sprinting and no cell wastes away below its base.
//
// Cadence: seat n decides on ticks ≡ n (mod the interval in ticks). `decideInTicks` is set at placement to the
// ticks until that next tick (`ticksUntilDecision`), counts down one per stepped tick and, reaching zero, the seat
// decides and the countdown restarts at the interval: seat 0 of a fresh world decides on ticks 30, 60, …; a seat
// placed at tick 21 599 by a fixture decides on tick 21 600 (W6); a fresh, respawned or placed seat sits still until then.

import { secondsToTicks, type BalanceConfig } from '@evolution/shared';
import { isCarried, isEngulfing } from '../simulation/engulf-state.js';
import { tryStartSprint } from '../simulation/inputs.js';
import { worldReferenceAt } from '../simulation/round-clock.js';
import type { CellRecord, SeatMindRecord } from '../world/entities.js';
import { seatedGiantCells, seatedWildCells } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { decideSeatCommand, type SeatDecisionContext } from './seat-decision.js';
import { giantSeatProfile, wildSeatProfile, type SeatMindProfile } from './seat-profile.js';
import { aimWildHunt } from './wild-hunt-aim.js';
import { giveUpStaleHunt, latchHunt } from './wild-hunt-give-up.js';

export function decisionIntervalTicks(balance: BalanceConfig): number {
  return secondsToTicks(balance.wildCells.WILD_CELL_DECISION_INTERVAL_SECONDS);
}

/**
 * The ticks from `tick` to the next tick strictly after it that is ≡ `seatNumber` (mod `intervalTicks`): what a
 * seat placed during `tick` (world creation at tick 0, a step-9 respawn, a fixture before the next step) waits.
 */
export function ticksUntilDecision(tick: number, seatNumber: number, intervalTicks: number): number {
  const remainder = (((seatNumber - tick) % intervalTicks) + intervalTicks) % intervalTicks;
  return remainder === 0 ? intervalTicks : remainder;
}

/**
 * Starts the player's sprint unless the cell is engulfing or carried (a sprint could do nothing there), and books its
 * cost: the part the growth covers comes off the growth and the full size for good; the rest leaves the cell below
 * its full size, a wound the next settles recover.
 */
export function startWildSprint(seat: SeatMindRecord, cell: CellRecord, balance: BalanceConfig): boolean {
  if (isEngulfing(cell) || isCarried(cell)) {
    return false;
  }
  const massBefore = cell.mass;
  if (!tryStartSprint(cell, balance)) {
    return false;
  }
  const spentFromGrowth = Math.min(massBefore - cell.mass, Math.max(0, seat.grownMass));
  seat.fullMass -= spentFromGrowth;
  seat.grownMass -= spentFromGrowth;
  return true;
}

/** Counts the seat down; on zero it decides by its profile, latches the target, may sprint, and restarts the countdown. */
function advanceSeat(seat: SeatMindRecord, cell: CellRecord, profile: SeatMindProfile, decision: SeatDecisionContext) {
  seat.decideInTicks -= 1;
  if (seat.decideInTicks > 0) {
    return;
  }
  seat.decideInTicks = decisionIntervalTicks(decision.step.balance);
  giveUpStaleHunt(seat, cell, decision.world.tick, profile.hunt);
  const command = decideSeatCommand(seat, cell, profile, decision);
  cell.targetX = command.target.x;
  cell.targetY = command.target.y;
  latchHunt(seat, command.huntPreyId, decision.world.tick);
  if (command.isSprinting) {
    startWildSprint(seat, cell, decision.step.balance);
  }
}

/**
 * Step 1 for the seats, after the settles: every seated cell counted down, the due ones decided and every hunt
 * re-aimed, the wild seats then the giant seats, in seat order.
 */
export function decideSeatTargets(world: WorldState, step: StepContext): void {
  const decision: SeatDecisionContext = { world, step, worldStage: worldReferenceAt(world, world.tick).worldStage };
  const wildProfile = wildSeatProfile(step.balance);
  for (const { seat, cell } of seatedWildCells(world)) {
    advanceSeat(seat, cell, wildProfile, decision);
    aimWildHunt(seat, cell, world, step.balance);
  }
  for (const { seat, cell } of seatedGiantCells(world)) {
    advanceSeat(seat, cell, giantSeatProfile(seat.species, step.balance), decision);
    aimWildHunt(seat, cell, world, step.balance);
  }
}
