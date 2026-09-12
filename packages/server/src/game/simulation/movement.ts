// Step 3 (docs/ECOLOGY.md §5.2): the shared kernel per cell with the speed cap folded from the
// mass curve, the sprint, the zone and the traits; the sprint counters tick down; then
// separation (contact.ts) and the fixture pins are restored.

import {
  clampToDish,
  engulfPhaseOf,
  gelSpeedFactor,
  maxSpeedForMass,
  predatorEngulfSpeedFactor,
  preyHeldSpeedFactor,
  steerBlendPerTick,
  steerCommand,
  stepMovementFrom,
  TICK_INTERVAL_S,
  ZONE_ID,
  type BalanceConfig,
  type MovementPose,
  type MovementStep,
  type SteerCommand,
} from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { separateOverlappingCells } from './contact.js';
import { engulfedPreyOf, engulfingPredatorOf, isCarried } from './engulf-state.js';
import { zoneAt } from './zones.js';

/** `SPRINT_SPEED_MULTIPLIER + sprintSpeedMultiplierBonus` while a sprint runs, 1 otherwise. */
export function sprintSpeedFactor(cell: CellRecord, balance: BalanceConfig): number {
  if (cell.sprintRemainingTicks <= 0) {
    return 1;
  }
  return balance.controls.SPRINT_SPEED_MULTIPLIER + cell.modifiers.sprintSpeedMultiplierBonus;
}

/** The gel factor inside a gel patch (with the amoeba floor), 1 elsewhere. */
export function zoneSpeedFactor(cell: CellRecord, world: WorldState, balance: BalanceConfig): number {
  if (zoneAt(cell, world.gelPatches, balance) !== ZONE_ID.viscousGel) {
    return 1;
  }
  return gelSpeedFactor(cell.mass, balance.growth, cell.modifiers.gelSpeedFactorFloor);
}

/** Neither engulfing nor engulfed: the cap is untouched by docs/ECOLOGY.md §6.1. */
const NO_ENGULF_FACTOR = 1;

/**
 * The engulf factor of docs/ECOLOGY.md §6.1, read from the engulf state at the end of the previous
 * tick (movement is step 3, engulf step 6): the held factor as prey, the predator's factor as
 * predator, and the product when a cell is both (a chain). A cell that is neither pays 1.
 */
export function engulfSpeedFactor(cell: CellRecord, world: WorldState, balance: BalanceConfig): number {
  const absorption = balance.absorption;
  let factor = NO_ENGULF_FACTOR;
  const predator = engulfingPredatorOf(world, cell);
  if (predator !== undefined) {
    factor *= preyHeldSpeedFactor(
      engulfPhaseOf(cell.engulfProgress, absorption),
      predator.modifiers.gripStrengthBonus,
      cell.modifiers.gripResistanceBonus,
      absorption,
    );
  }
  const prey = engulfedPreyOf(world, cell);
  if (prey !== undefined) {
    factor *= predatorEngulfSpeedFactor(engulfPhaseOf(prey.engulfProgress, absorption), absorption);
  }
  return factor;
}

/** `maxSpeed(mass) × sprint × zone × trait × engulf` (wu/s). */
export function speedCapOf(cell: CellRecord, world: WorldState, balance: BalanceConfig): number {
  return (
    maxSpeedForMass(cell.mass, balance.growth) *
    sprintSpeedFactor(cell, balance) *
    zoneSpeedFactor(cell, world, balance) *
    cell.modifiers.speedMultiplier *
    engulfSpeedFactor(cell, world, balance)
  );
}

/** This tick's steer command for one cell, from its start-of-tick pose (docs/ECOLOGY.md §5.2). */
function steerCommandOf(cell: CellRecord, balance: BalanceConfig): SteerCommand {
  return steerCommand(cell, {
    targetX: cell.targetX,
    targetY: cell.targetY,
    radiusWu: cell.radius,
    controls: balance.controls,
  });
}

/** The kernel's step for one cell, everything but the command (which the caller has already taken). */
function movementStepOf(cell: CellRecord, world: WorldState, balance: BalanceConfig): MovementStep {
  const accelerationSeconds = balance.growth.CELL_ACCELERATION_SECONDS * cell.modifiers.accelerationSecondsMultiplier;
  return {
    targetX: cell.targetX,
    targetY: cell.targetY,
    radiusWu: cell.radius,
    speedCapWuPerSecond: speedCapOf(cell, world, balance),
    blendPerTick: steerBlendPerTick(accelerationSeconds, TICK_INTERVAL_S),
    tickIntervalS: TICK_INTERVAL_S,
    dishRadiusWu: balance.world.DISH_RADIUS,
    controls: balance.controls,
  };
}

/** The one write-back of a pose onto a record, shared by the moved and the carried paths. */
function applyPose(cell: CellRecord, pose: MovementPose): void {
  cell.x = pose.x;
  cell.y = pose.y;
  cell.velocityX = pose.velocityX;
  cell.velocityY = pose.velocityY;
}

function moveCell(cell: CellRecord, world: WorldState, balance: BalanceConfig): void {
  applyPose(cell, stepMovementFrom(cell, cell.steerCommand, movementStepOf(cell, world, balance)));
}

/**
 * The sprint clocks age on every cell, moved or carried (docs/GAME-DESIGN.md §6: they are wall-clock
 * durations, and `tryStartSprint` charges the mass at step 1 whatever the cell's speed cap turns out
 * to be). A sealed prey therefore spends the sprint it paid for instead of banking it
 * (docs/ECOLOGY.md §6.3, the "prey moves away after the seal" row).
 */
function ageSprintClocks(cell: CellRecord): void {
  cell.sprintRemainingTicks = Math.max(0, cell.sprintRemainingTicks - 1);
  cell.sprintCooldownRemainingTicks = Math.max(0, cell.sprintCooldownRemainingTicks - 1);
}

/** A pinned cell's centre is restored after movement and separation (docs/ECOLOGY.md §8). */
function restorePins(world: WorldState): void {
  for (const cell of world.cells) {
    if (cell.pinnedX !== null && cell.pinnedY !== null) {
      cell.x = cell.pinnedX;
      cell.y = cell.pinnedY;
    }
  }
}

/**
 * A carried prey (docs/ECOLOGY.md §6.1, from the seal on) skips the kernel: its centre is its
 * predator's plus the frozen offset and its velocity is the predator's, resolved after the
 * predator has moved. A carried predator is resolved first, so a sealed B carrying C rides A and
 * carries C from its own carried centre (§6.3, the chain row).
 */
function placeCarriedCell(cell: CellRecord, world: WorldState, placed: Set<CellRecord>, balance: BalanceConfig): void {
  if (placed.has(cell)) {
    return;
  }
  placed.add(cell);
  const predator = engulfingPredatorOf(world, cell);
  if (predator === undefined || cell.carriedOffsetX === null || cell.carriedOffsetY === null) {
    return;
  }
  placeCarriedCell(predator, world, placed, balance);
  // The same wall clamp the kernel applies, so docs/ECOLOGY.md §6.3 "engulf at the wall" ("clamping
  // only moves centres inward") keeps holding for a carried prey that never goes through the kernel.
  const carried = {
    x: predator.x + cell.carriedOffsetX,
    y: predator.y + cell.carriedOffsetY,
    velocityX: predator.velocityX,
    velocityY: predator.velocityY,
  };
  applyPose(cell, clampToDish(carried, cell.radius, balance.world.DISH_RADIUS));
}

export function moveCells(world: WorldState, context: StepContext): void {
  // The command is taken for every cell from its start-of-tick pose and kept on the record, so the
  // engulf struggle at step 6 reads the very command this step moved on (docs/ECOLOGY.md §5.2, §6.1).
  for (const cell of world.cells) {
    cell.steerCommand = steerCommandOf(cell, context.balance);
  }
  for (const cell of world.cells) {
    if (!isCarried(cell)) {
      moveCell(cell, world, context.balance);
    }
  }
  const placed = new Set<CellRecord>();
  for (const cell of world.cells) {
    if (isCarried(cell)) {
      placeCarriedCell(cell, world, placed, context.balance);
    }
  }
  // After the move, as it has always been for a moving cell (G7 counts the sprint from there).
  for (const cell of world.cells) {
    ageSprintClocks(cell);
  }
  separateOverlappingCells(world, context.balance);
  restorePins(world);
}
