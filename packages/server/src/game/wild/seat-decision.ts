// One seat's decision (docs/ecology/wild-cells.md §3.3.3, docs/ecology/giants.md §3.5.5–§3.5.7): the engulf escape,
// then the rules its profile names in order (`seat-profile.ts`: a wild seat flee, hunt, graze; the giant hunter flee,
// hunt; the grazer flee, graze; the drifter flee), then the wander, over what lies in its sight (`wild-perception.ts`).
// The rules are the #15 strategies, each a fresh instance per decision because a seated cell keeps no state outside
// its seat record: `flee` (from any cell, player or wild, that can engulf it, sprinting within
// `WILD_CELL_SPRINT_FLEE_RADII`), a nearest-first `hunter` (wild prey from tick 0, players from the profile's stage,
// only prey in the profile's hunt window, leaving a prey to any cell in sight that could swallow it from strictly
// closer, sprinting within `WILD_CELL_SPRINT_HUNT_RADII` only when the sprint can land, `wild-hunt-sprint.ts`) and the
// `grazer` over the motes its diet eats now, ahead of it first when its diet has a cone (`seat-graze.ts`). A cell
// being engulfed before the seal flees its predator and sprints, the player's engulf-escape tool. The profile's stream
// is the only randomness (the wander's turn roll and headings); the other rules draw nothing.

import { entityId, type BalanceConfig, type CellStage, type EntityId, type Vec2 } from '@evolution/shared';
import type { PlayerCommand, ScriptContext } from '../bots/bot-strategy.js';
import type { BotCellView } from '../bots/perception.js';
import { createFleeStrategy, fleeTargetFrom } from '../bots/strategies/flee.js';
import { createGrazerStrategy } from '../bots/strategies/grazer.js';
import { createHunterStrategy } from '../bots/strategies/hunter.js';
import { HUNT_PREFERENCE } from '../bots/strategy-constants.js';
import { mealKindsAt } from '../simulation/cell-diet.js';
import { engulfingPredatorOf, isCarried } from '../simulation/engulf-state.js';
import type { CellRecord, SeatMindRecord } from '../world/entities.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { isHuntResting } from './wild-hunt-give-up.js';
import { isFleeSprintWorthwhile, isHuntSprintWorthwhile } from './wild-hunt-sprint.js';
import {
  createWildHuntPerception,
  createWildPerception,
  wildSightOf,
  withoutGivenUpPrey,
  type WildPerception,
  type WildSight,
} from './wild-perception.js';
import { grazeCandidatesOf } from './seat-graze.js';
import { isPlayerPreyAt, SEAT_RULE, type SeatMindProfile, type SeatRule } from './seat-profile.js';
import { wanderTargetOf } from './wild-wander.js';

/** What this tick's decisions read and draw from: the world mid-step and its stage. */
export interface SeatDecisionContext {
  readonly world: WorldState;
  readonly step: StepContext;
  /** The world reference's stage for this tick: players are a seat's prey from its profile's stage. */
  readonly worldStage: CellStage;
}

/** One decision's outcome: the target to latch, whether the rule asked for a sprint, and the prey a hunt chases. */
export interface SeatCommand {
  readonly target: Vec2;
  readonly isSprinting: boolean;
  /** The hunted cell, which `aimWildHunt` re-aims at every tick until the next decision; `null` for any other rule. */
  readonly huntPreyId: EntityId | null;
}

/** What one seat's decision reads: its record, its cell, its profile, the tick's context and its strategy context. */
interface SeatDecision {
  readonly seat: SeatMindRecord;
  readonly cell: CellRecord;
  readonly profile: SeatMindProfile;
  readonly decision: SeatDecisionContext;
  readonly script: ScriptContext<WorldState, EntityId>;
}

function seatCommandOf(command: PlayerCommand | null): SeatCommand | null {
  return command === null || command.targetX === undefined || command.targetY === undefined
    ? null
    : {
        target: { x: command.targetX, y: command.targetY },
        isSprinting: command.isSprinting === true,
        huntPreyId: null,
      };
}

function scriptContextFor(
  seat: SeatMindRecord,
  cell: CellRecord,
  profile: SeatMindProfile,
  decision: SeatDecisionContext,
) {
  const { world, step } = decision;
  const context: ScriptContext<WorldState, EntityId> = {
    tick: world.tick - 1,
    stepTick: world.tick,
    playerIndex: seat.seatNumber,
    actorId: cell.id,
    snapshot: world,
    cell,
    seed: world.seed,
    random: step.streams[profile.randomStream],
  };
  return context;
}

/** The engulf-escape rule: a cell being engulfed, not yet sealed, runs from its predator and sprints. */
function escapeCommand(cell: CellRecord, decision: SeatDecisionContext): SeatCommand | null {
  const predator = isCarried(cell) ? undefined : engulfingPredatorOf(decision.world, cell);
  if (predator === undefined) {
    return null;
  }
  const target = fleeTargetFrom(cell, predator, decision.step.balance.controls.STEER_FULL_THROTTLE_RADII);
  return { target, isSprinting: true, huntPreyId: null };
}

/** What a sprint test reads: the two cells as records of this world, the deciding cell first. */
type SprintTest = (self: CellRecord, other: CellRecord, world: WorldState, balance: BalanceConfig) => boolean;

/** A rule's sprint test over the sight's own records (`wild-hunt-sprint.ts`). */
function sprintTestOver(sight: WildSight, decision: SeatDecisionContext, test: SprintTest) {
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

function fleeCommand(sight: WildSight, everything: WildPerception, seatDecision: SeatDecision): SeatCommand | null {
  const { decision, script } = seatDecision;
  const { wildCells, controls } = decision.step.balance;
  const fleeOptions = {
    withinRadii: wildCells.WILD_CELL_FLEE_RANGE_RADII,
    stepRadii: controls.STEER_FULL_THROTTLE_RADII,
    sprintWithinRadii: wildCells.WILD_CELL_SPRINT_FLEE_RADII,
    isSprintWorthwhile: sprintTestOver(sight, decision, isFleeSprintWorthwhile),
  };
  return seatCommandOf(createFleeStrategy(everything, fleeOptions)().decide(script));
}

/** The hunt: never the seat's `givenUpPreyId`, nor at all while it rests; only prey its profile's filter lets in. */
function huntCommand(sight: WildSight, seatDecision: SeatDecision): SeatCommand | null {
  const { seat, cell, profile, decision, script } = seatDecision;
  if (isHuntResting(seat, decision.world.tick)) {
    return null;
  }
  const { balance } = decision.step;
  let huntPreyId: EntityId | null = null;
  const huntOptions = {
    preference: HUNT_PREFERENCE.nearest,
    sprintWithinRadii: balance.wildCells.WILD_CELL_SPRINT_HUNT_RADII,
    isSprintWorthwhile: sprintTestOver(sight, decision, isHuntSprintWorthwhile),
    onHunt: (hunted: BotCellView) => {
      huntPreyId = entityId(hunted.id);
    },
  };
  const filter = {
    isPlayerPrey: isPlayerPreyAt(profile.hunt, decision.worldStage),
    minPreyMassFraction: profile.hunt.minPreyMassFraction,
  };
  const prey = withoutGivenUpPrey(createWildHuntPerception(sight, balance, cell, filter), seat.givenUpPreyId);
  const command = seatCommandOf(createHunterStrategy(prey, huntOptions)().decide(script));
  return command === null ? null : { ...command, huntPreyId };
}

/** The graze over the motes in sight (only those its diet eats now), ahead of it first when its diet has a cone. */
function grazeCommand(sight: WildSight, everything: WildPerception, seatDecision: SeatDecision): SeatCommand | null {
  const { seat, cell, profile, script } = seatDecision;
  const candidates = grazeCandidatesOf(sight.motes, cell, seat, profile.diet);
  const grazing: WildPerception = { ...everything, motesOf: () => candidates };
  return seatCommandOf(createGrazerStrategy(grazing)().decide(script));
}

/** The profile's rules in order over what the cell sees; `null` when none applies. */
function sightedCommand(seatDecision: SeatDecision): SeatCommand | null {
  const { seat, cell, profile, decision } = seatDecision;
  const { balance } = decision.step;
  const sight = wildSightOf(decision.world, cell, balance, mealKindsAt(profile.diet, seat.grownMass));
  const everything = createWildPerception(sight, balance);
  const commandOf: Readonly<Record<SeatRule, () => SeatCommand | null>> = {
    [SEAT_RULE.flee]: () => fleeCommand(sight, everything, seatDecision),
    [SEAT_RULE.hunt]: () => huntCommand(sight, seatDecision),
    [SEAT_RULE.graze]: () => grazeCommand(sight, everything, seatDecision),
  };
  for (const rule of profile.rules) {
    const command = commandOf[rule]();
    if (command !== null) {
      return command;
    }
  }
  return null;
}

/** One decision: escape, the profile's rules, else wander (docs/ecology/wild-cells.md §3.3.3); always a target. */
export function decideSeatCommand(
  seat: SeatMindRecord,
  cell: CellRecord,
  profile: SeatMindProfile,
  decision: SeatDecisionContext,
): SeatCommand {
  const escape = escapeCommand(cell, decision);
  if (escape !== null) {
    return escape;
  }
  const script = scriptContextFor(seat, cell, profile, decision);
  const sighted = sightedCommand({ seat, cell, profile, decision, script });
  const { balance } = decision.step;
  return (
    sighted ?? {
      target: wanderTargetOf(seat, cell, { random: script.random, turnChance: profile.turnChance }, balance),
      isSprinting: false,
      huntPreyId: null,
    }
  );
}
