// Step 1 for the wild seats' minds (docs/ecology/wild-cells.md §3.3.3, docs/architecture/server-simulation.md §3.4):
// after the settle, every seat whose countdown ran out decides flee, then hunt, then graze, then wander, over what
// lies in its sight (`wild-perception.ts`), latches the target on its cell exactly as a player's input is latched, so
// step 3 moves it through the shared kernel, and may start a sprint. The rules are the #15 strategies, each a fresh
// instance per decision because a wild cell keeps no state outside its seat record: `flee` (from any cell, player or
// wild, that can engulf it, sprinting within `WILD_CELL_SPRINT_FLEE_RADII`), a nearest-first `hunter` (wild prey from
// tick 0, players from `WILD_CELL_HUNTS_PLAYERS_FROM_STAGE`, sprinting within `WILD_CELL_SPRINT_HUNT_RADII` only when
// the sprint can land, `wild-hunt-sprint.ts`) and the
// `grazer` over algae and detritus; the wander rule keeps its heading in the seat (`wild-wander.ts`). A cell being
// engulfed before the seal flees its predator and sprints, the player's engulf-escape tool.
//
// A sprint is the player's own (`tryStartSprint`: cooldown, duration and a cost floored at `massFloorOf`), started
// only on a decision and never while engulfing or carried. Its cost comes off the growth first, spent for good like a
// player's; whatever it takes below the base size is a wound the settle recovers (the lead's ruling on the #594
// review), so a fat cell pays for sprinting and no cell wastes away below its base. The seat's
// `wildCells` stream is the only randomness (the wander's turn roll and headings); the other rules draw nothing.
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
import { createFleeStrategy, fleeTargetFrom } from '../bots/strategies/flee.js';
import { createGrazerStrategy } from '../bots/strategies/grazer.js';
import { createHunterStrategy } from '../bots/strategies/hunter.js';
import type { BotCellView } from '../bots/perception.js';
import { HUNT_PREFERENCE } from '../bots/strategy-constants.js';
import { engulfingPredatorOf, isCarried, isEngulfing } from '../simulation/engulf-state.js';
import { tryStartSprint } from '../simulation/inputs.js';
import { worldReferenceAt } from '../simulation/round-clock.js';
import type { CellRecord, WildSeatRecord } from '../world/entities.js';
import { seatedWildCells } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { isFleeSprintWorthwhile, isHuntSprintWorthwhile } from './wild-hunt-sprint.js';
import { createWildPerception, wildSightOf, type WildSight } from './wild-perception.js';
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

/** What this tick's decisions read and draw from: the world mid-step and whether players are prey yet. */
export interface WildDecisionContext {
  readonly world: WorldState;
  readonly step: StepContext;
  /** `worldStage ≥ WILD_CELL_HUNTS_PLAYERS_FROM_STAGE` for this tick. */
  readonly isHuntingStage: boolean;
}

/** One decision's outcome: the target to latch and whether the rule asked for a sprint. */
export interface WildCommand {
  readonly target: Vec2;
  readonly isSprinting: boolean;
}

function wildCommandOf(command: PlayerCommand | null): WildCommand | null {
  return command === null || command.targetX === undefined || command.targetY === undefined
    ? null
    : { target: { x: command.targetX, y: command.targetY }, isSprinting: command.isSprinting === true };
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

/** The engulf-escape rule: a cell being engulfed, not yet sealed, runs from its predator and sprints. */
function escapeCommand(cell: CellRecord, decision: WildDecisionContext): WildCommand | null {
  const predator = isCarried(cell) ? undefined : engulfingPredatorOf(decision.world, cell);
  if (predator === undefined) {
    return null;
  }
  const target = fleeTargetFrom(cell, predator, decision.step.balance.controls.STEER_FULL_THROTTLE_RADII);
  return { target, isSprinting: true };
}

/** What a sprint test reads: the two cells as records of this world, the deciding cell first. */
type SprintTest = (self: CellRecord, other: CellRecord, world: WorldState, balance: BalanceConfig) => boolean;

/** A rule's sprint test over the sight's own records (`wild-hunt-sprint.ts`). */
function sprintTestOver(sight: WildSight, decision: WildDecisionContext, test: SprintTest) {
  const recordOf = new Map<string, CellRecord>(sight.cells.map((cell) => [cell.id, cell]));
  return (self: BotCellView, other: BotCellView): boolean => {
    const deciding = recordOf.get(self.id);
    const counterpart = recordOf.get(other.id);
    return (
      deciding !== undefined &&
      counterpart !== undefined &&
      test(deciding, counterpart, decision.world, decision.step.balance)
    );
  };
}

/** Flee, then hunt, then graze, over what the cell sees; `null` when none applies. */
function sightedCommand(
  context: ScriptContext<WorldState, EntityId>,
  sight: WildSight,
  decision: WildDecisionContext,
): WildCommand | null {
  const { balance } = decision.step;
  const { wildCells, controls } = balance;
  const everything = createWildPerception(sight, balance);
  const fleeOptions = {
    withinRadii: wildCells.WILD_CELL_FLEE_RANGE_RADII,
    stepRadii: controls.STEER_FULL_THROTTLE_RADII,
    sprintWithinRadii: wildCells.WILD_CELL_SPRINT_FLEE_RADII,
    isSprintWorthwhile: sprintTestOver(sight, decision, isFleeSprintWorthwhile),
  };
  const huntOptions = {
    preference: HUNT_PREFERENCE.nearest,
    sprintWithinRadii: wildCells.WILD_CELL_SPRINT_HUNT_RADII,
    isSprintWorthwhile: sprintTestOver(sight, decision, isHuntSprintWorthwhile),
  };
  const prey = createWildPerception(sight, balance, decision.isHuntingStage);
  return (
    wildCommandOf(createFleeStrategy(everything, fleeOptions)().decide(context)) ??
    wildCommandOf(createHunterStrategy(prey, huntOptions)().decide(context)) ??
    wildCommandOf(createGrazerStrategy(everything)().decide(context))
  );
}

/** One decision: escape, flee, hunt, graze, else wander (docs/ecology/wild-cells.md §3.3.3); always a target. */
export function decideWildCommand(seat: WildSeatRecord, cell: CellRecord, decision: WildDecisionContext): WildCommand {
  const escape = escapeCommand(cell, decision);
  if (escape !== null) {
    return escape;
  }
  const { world, step } = decision;
  const context = scriptContextFor(seat, cell, decision);
  const sighted = sightedCommand(context, wildSightOf(world, cell, step.balance), decision);
  return sighted ?? { target: wanderTargetOf(seat, cell, context.random, step.balance), isSprinting: false };
}

/**
 * Starts the player's sprint unless the cell is engulfing or carried (a sprint could do nothing there), and books its
 * cost: the part the growth covers comes off the growth and the full size for good; the rest leaves the cell below
 * its full size, a wound the next settles recover.
 */
export function startWildSprint(seat: WildSeatRecord, cell: CellRecord, balance: BalanceConfig): boolean {
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

/** Counts the seat down; on zero it decides, latches the target, may sprint, and restarts the countdown. */
function advanceSeat(seat: WildSeatRecord, cell: CellRecord, decision: WildDecisionContext): void {
  seat.decideInTicks -= 1;
  if (seat.decideInTicks > 0) {
    return;
  }
  seat.decideInTicks = decisionIntervalTicks(decision.step.balance);
  const command = decideWildCommand(seat, cell, decision);
  cell.targetX = command.target.x;
  cell.targetY = command.target.y;
  if (command.isSprinting) {
    startWildSprint(seat, cell, decision.step.balance);
  }
}

/** Step 1 for the wild seats, after the settle: every seated cell counted down, the due ones decided, in seat order. */
export function decideWildTargets(world: WorldState, step: StepContext): void {
  const reference = worldReferenceAt(world, world.tick);
  const decision: WildDecisionContext = {
    world,
    step,
    isHuntingStage: hasReachedStage(reference.worldStage, step.balance.wildCells.WILD_CELL_HUNTS_PLAYERS_FROM_STAGE),
  };
  for (const { seat, cell } of seatedWildCells(world)) {
    advanceSeat(seat, cell, decision);
  }
}
