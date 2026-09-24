// Step 1 (docs/architecture/server-simulation.md §3.2): per player in join order, show a queued offer, apply the
// coalesced input (target latched, sprint and trait choice as one-shots), then fold the cell's
// modifiers and stage so a pick affects this tick's movement and metabolism (docs/traits/model.md §2). The player's
// carried stage is refreshed here for every player, cell or not, so no writer of `ownedTraits` can leave it stale
// past one tick.

import {
  MASS_WINDOW_AMOUNT,
  hasSteerTarget,
  massAfterSprint,
  sprintCooldownTicksFor,
  sprintDurationTicks,
  type BalanceConfig,
  type GameInput,
} from '@evolution/shared';
import { refreshPlayerStage } from '../progression/ladder.js';
import { refreshCellDerivedState } from '../progression/modifiers.js';
import { applyTraitChoice, showQueuedOfferIfNone } from '../progression/offers.js';
import type { CellRecord, PlayerRecord } from '../world/entities.js';
import { findCellOfPlayer } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { recordWindowAmount } from '../world/mass-flow-ledger.js';
import { massFloorOf, setCellMass } from './cell-mass.js';

/** The cooldown a sprint starts with: the shared `sprintCooldownTicksFor` of this cell's delta (docs/traits/model.md §2). */
export function sprintCooldownTicks(cell: CellRecord, balance: BalanceConfig): number {
  return sprintCooldownTicksFor(cell.modifiers.sprintCooldownSecondsDelta, balance);
}

/**
 * Starts a sprint when the cooldown allows (docs/game-design/controls-and-scope.md §6): the duration and cooldown
 * counters are set and the mass cost paid, floored at the cell's `massFloorOf` (the starting mass for a player, never
 * a lift for a small wild cell). False when on cooldown.
 */
export function tryStartSprint(cell: CellRecord, balance: BalanceConfig): boolean {
  if (cell.sprintCooldownRemainingTicks > 0) {
    return false;
  }
  cell.sprintRemainingTicks = sprintDurationTicks(balance);
  cell.sprintCooldownRemainingTicks = sprintCooldownTicks(cell, balance);
  setCellMass(cell, massAfterSprint(cell.mass, balance, massFloorOf(cell, cell.mass, balance)), balance);
  return true;
}

/**
 * An input without a target leaves the latch alone, so a respawned cell keeps its null target through
 * the inputs its client built while spectating (docs/ecology/mass-and-movement.md §5.2, #346). Answers the mass a
 * sprint start took (0 without one), which the snapshot reports (#383).
 */
function applyCellInput(cell: CellRecord, input: GameInput, context: StepContext): number {
  if (hasSteerTarget(input)) {
    cell.targetX = input.targetX;
    cell.targetY = input.targetY;
  }
  if (!input.shouldSprint) {
    return 0;
  }
  const massBeforeSprint = cell.mass;
  if (!tryStartSprint(cell, context.balance)) {
    context.rejections.sprintOnCooldown += 1;
  }
  return massBeforeSprint - cell.mass;
}

/**
 * **Invariant the client's trait-pick retry depends on: the sequence and the choice are recorded
 * in one tick, by this function.** `appliedInputSequence` advances and `applyTraitChoice` resolves
 * (applies or rejects) without a tick between them, so a snapshot can never show a sequence past a
 * pick whose fate is still undecided. The client reads "the server answered past my send and the
 * offer is still open" as *rejected* and resends (`client/src/app/game/input/trait-pick.ts`); split
 * these two lines across ticks and a successful pick would read as rejected and be sent twice.
 * Pinned by `inputs.test.ts` ("records the sequence and resolves the choice in the same tick" and
 * its rejected twin).
 */
function applyPlayerInput(world: WorldState, player: PlayerRecord, context: StepContext): void {
  const input = player.pendingInput;
  if (input === null) {
    return;
  }
  player.pendingInput = null;
  player.appliedInputSequence = input.sequence;
  const cell = findCellOfPlayer(world, player.playerId);
  if (cell !== undefined) {
    const sprintSpent = applyCellInput(cell, input, context);
    if (sprintSpent > 0) {
      recordWindowAmount(world.massFlow, player.playerId, MASS_WINDOW_AMOUNT.sprintSpent, sprintSpent);
    }
  }
  if (input.traitChoice !== null) {
    applyTraitChoice(world, player, input.traitChoice, context);
  }
}

export function applyInputs(world: WorldState, context: StepContext): void {
  for (const player of world.players) {
    showQueuedOfferIfNone(world, player, context);
    applyPlayerInput(world, player, context);
    refreshPlayerStage(player, context.balance);
    const cell = findCellOfPlayer(world, player.playerId);
    if (cell !== undefined) {
      refreshCellDerivedState(cell, player, context.balance);
    }
  }
}
