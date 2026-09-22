// Step 1 for the wild seats' minds (docs/ecology/wild-cells.md §3.3 "Behaviour", docs/architecture/server-simulation.md
// §3): after the pin, every seat whose countdown ran out decides flee, then hunt, then wander, and latches the
// target on its cell exactly as a player's input is latched, so step 3 moves it through the shared kernel. The
// decisions are the #15 strategies over the wild perception (`wild-perception.ts`): `flee` and a range-bound,
// nearest-first `hunter`, each a fresh instance per decision because a wild cell keeps no state outside its seat
// record (a fresh hunter holds no commitment); the wander rule keeps its heading in the seat (`wild-wander.ts`).
// A wild cell never sprints: only the command's target is taken. The seat's `wildCells` stream is the only
// randomness (the wander's turn roll and headings); the flee and hunt rules draw nothing.
//
// Cadence: seat n decides on ticks ≡ n (mod the interval in ticks). `decideInTicks` is set at placement to the
// ticks until that next tick (`ticksUntilDecision`), counts down one per stepped tick and, reaching zero, the seat
// decides and the countdown restarts at the interval: seat 0 of a fresh world decides on ticks 30, 60, …; a seat
// placed at tick 21 599 by a fixture decides on tick 21 600 (W6); a fresh, respawned or placed seat sits still until then.

import {
  hasReachedStage,
  RANDOM_STREAM,
  secondsToTicks,
  type BalanceConfig,
  type EntityId,
  type Vec2,
} from '@evolution/shared';
import type { PlayerCommand, ScriptContext } from '../bots/bot-strategy.js';
import { createFleeStrategy } from '../bots/strategies/flee.js';
import { createHunterStrategy } from '../bots/strategies/hunter.js';
import { HUNT_PREFERENCE } from '../bots/strategy-constants.js';
import { worldReferenceAt } from '../simulation/round-clock.js';
import type { CellRecord, WildSeatRecord } from '../world/entities.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { cellOfSeat } from './wild-pin.js';
import { createWildPerception, type WildPerception } from './wild-perception.js';
import { wanderTargetOf } from './wild-wander.js';

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

/** What this decision reads and draws from: the world mid-step, the seat's cell and the `wildCells` stream. */
export interface WildDecisionContext {
  readonly world: WorldState;
  readonly perception: WildPerception;
  readonly step: StepContext;
  /** `worldStage ≥ WILD_CELL_HUNTS_FROM_STAGE` for this tick. */
  readonly isHuntingStage: boolean;
}

function commandTarget(command: PlayerCommand | null): Vec2 | null {
  return command === null || command.targetX === undefined || command.targetY === undefined
    ? null
    : { x: command.targetX, y: command.targetY };
}

function scriptContextFor(seat: WildSeatRecord, cell: CellRecord, decision: WildDecisionContext) {
  const { world, step } = decision;
  const context: ScriptContext<WorldState, EntityId> = {
    tick: world.tick - 1,
    stepTick: world.tick,
    playerIndex: seat.seatNumber,
    actorId: cell.id,
    snapshot: world,
    cell,
    seed: world.seed,
    random: step.streams[RANDOM_STREAM.wildCells],
  };
  return context;
}

/** One decision: flee, else hunt (from the hunting stage on), else wander; always a target. */
export function decideWildTarget(seat: WildSeatRecord, cell: CellRecord, decision: WildDecisionContext): Vec2 {
  const { perception, step, isHuntingStage } = decision;
  const { wildCells, controls } = step.balance;
  const context = scriptContextFor(seat, cell, decision);
  const fleeOptions = {
    withinRadii: wildCells.WILD_CELL_FLEE_RANGE_RADII,
    stepRadii: controls.STEER_FULL_THROTTLE_RADII,
  };
  const flee = commandTarget(createFleeStrategy(perception, fleeOptions)().decide(context));
  if (flee !== null) {
    return flee;
  }
  const huntOptions = { withinRadii: wildCells.WILD_CELL_HUNT_RANGE_RADII, preference: HUNT_PREFERENCE.nearest };
  const hunt = isHuntingStage ? commandTarget(createHunterStrategy(perception, huntOptions)().decide(context)) : null;
  return hunt ?? wanderTargetOf(seat, cell, context.random, step.balance);
}

/** Counts the seat down; on zero it decides, latches the target and restarts the countdown. */
function advanceSeat(seat: WildSeatRecord, cell: CellRecord, decision: WildDecisionContext): void {
  seat.decideInTicks -= 1;
  if (seat.decideInTicks > 0) {
    return;
  }
  seat.decideInTicks = decisionIntervalTicks(decision.step.balance);
  const target = decideWildTarget(seat, cell, decision);
  cell.targetX = target.x;
  cell.targetY = target.y;
}

/** Step 1 for the wild seats, after the pin: every seated cell counted down, the due ones decided, in seat order. */
export function decideWildTargets(world: WorldState, step: StepContext): void {
  const reference = worldReferenceAt(world, world.tick);
  const decision: WildDecisionContext = {
    world,
    perception: createWildPerception(step.balance),
    step,
    isHuntingStage: hasReachedStage(reference.worldStage, step.balance.wildCells.WILD_CELL_HUNTS_FROM_STAGE),
  };
  for (const seat of world.wildSeats) {
    const cell = cellOfSeat(world, seat);
    if (cell !== undefined) {
      advanceSeat(seat, cell, decision);
    }
  }
}
