// Step 1 (docs/ARCHITECTURE.md §3.2): per player in join order, show a queued offer, apply the
// coalesced input (target latched, sprint and trait choice as one-shots), then fold the cell's
// modifiers and stage so a pick affects this tick's movement and metabolism (docs/TRAITS.md §2).

import { secondsToTicks, type BalanceConfig, type GameInput } from '@evolution/shared';
import { refreshCellDerivedState } from '../progression/modifiers.js';
import { applyTraitChoice, showQueuedOfferIfNone } from '../progression/offers.js';
import type { CellRecord, PlayerRecord } from '../world/entities.js';
import { findCellOfPlayer } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { loseMassToFloor } from './cell-mass.js';

/** The cooldown a sprint starts with: `SPRINT_COOLDOWN_SECONDS + delta`, floored (docs/TRAITS.md §2). */
export function sprintCooldownTicks(cell: CellRecord, balance: BalanceConfig): number {
  const seconds = Math.max(
    balance.controls.SPRINT_COOLDOWN_SECONDS + cell.modifiers.sprintCooldownSecondsDelta,
    balance.traits.SPRINT_COOLDOWN_FLOOR_SECONDS,
  );
  return secondsToTicks(seconds);
}

/**
 * Starts a sprint when the cooldown allows (docs/GAME-DESIGN.md §6): the duration and cooldown
 * counters are set and the mass cost paid, floored at the starting mass. False when on cooldown.
 */
export function tryStartSprint(cell: CellRecord, balance: BalanceConfig): boolean {
  if (cell.sprintCooldownRemainingTicks > 0) {
    return false;
  }
  cell.sprintRemainingTicks = secondsToTicks(balance.controls.SPRINT_DURATION_SECONDS);
  cell.sprintCooldownRemainingTicks = sprintCooldownTicks(cell, balance);
  loseMassToFloor(cell, cell.mass * (1 - balance.controls.SPRINT_MASS_COST_FRACTION), balance);
  return true;
}

function applyCellInput(cell: CellRecord, input: GameInput, context: StepContext): void {
  cell.targetX = input.targetX;
  cell.targetY = input.targetY;
  if (input.shouldSprint && !tryStartSprint(cell, context.balance)) {
    context.rejections.sprintOnCooldown += 1;
  }
}

function applyPlayerInput(world: WorldState, player: PlayerRecord, context: StepContext): void {
  const input = player.pendingInput;
  if (input === null) {
    return;
  }
  player.pendingInput = null;
  player.appliedInputSequence = input.sequence;
  const cell = findCellOfPlayer(world, player.playerId);
  if (cell !== undefined) {
    applyCellInput(cell, input, context);
  }
  if (input.traitChoice !== null) {
    applyTraitChoice(world, player, input.traitChoice, context);
  }
}

export function applyInputs(world: WorldState, context: StepContext): void {
  for (const player of world.players) {
    showQueuedOfferIfNone(world, player, context);
    applyPlayerInput(world, player, context);
    const cell = findCellOfPlayer(world, player.playerId);
    if (cell !== undefined) {
      refreshCellDerivedState(cell, player, context.balance);
    }
  }
}
