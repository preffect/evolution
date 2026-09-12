// Step 3 (docs/ECOLOGY.md §5.2): the shared kernel per cell with the speed cap folded from the
// mass curve, the sprint, the zone and the traits; the sprint counters tick down; then
// separation (contact.ts) and the fixture pins are restored.

import {
  engulfPhaseOf,
  engulfPredatorPaceModifiersOf,
  engulfPreyPaceModifiersOf,
  gelSpeedFactor,
  maxSpeedForMass,
  predatorEngulfSpeedFactor,
  preyHeldSpeedFactor,
  stepMovementKernel,
  steerBlendPerTick,
  TICK_INTERVAL_S,
  ZONE_ID,
  type BalanceConfig,
} from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';
import { findCell } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { separateOverlappingCells } from './contact.js';
import { engulfingPredatorOf, isCarried } from './engulf-state.js';
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
      engulfPredatorPaceModifiersOf(predator.modifiers).gripStrengthBonus,
      engulfPreyPaceModifiersOf(cell.modifiers).gripResistanceBonus,
      absorption,
    );
  }
  const prey = cell.engulfingCellId === null ? undefined : findCell(world, cell.engulfingCellId);
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

function moveCell(cell: CellRecord, world: WorldState, balance: BalanceConfig): void {
  const accelerationSeconds = balance.growth.CELL_ACCELERATION_SECONDS * cell.modifiers.accelerationSecondsMultiplier;
  const pose = stepMovementKernel(cell, {
    targetX: cell.targetX,
    targetY: cell.targetY,
    radiusWu: cell.radius,
    speedCapWuPerSecond: speedCapOf(cell, world, balance),
    blendPerTick: steerBlendPerTick(accelerationSeconds, TICK_INTERVAL_S),
    tickIntervalS: TICK_INTERVAL_S,
    dishRadiusWu: balance.world.DISH_RADIUS,
    controls: balance.controls,
  });
  cell.x = pose.x;
  cell.y = pose.y;
  cell.velocityX = pose.velocityX;
  cell.velocityY = pose.velocityY;
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
function placeCarriedCell(cell: CellRecord, world: WorldState, placed: Set<CellRecord>): void {
  if (placed.has(cell)) {
    return;
  }
  placed.add(cell);
  const predator = engulfingPredatorOf(world, cell);
  if (predator === undefined || cell.carriedOffsetX === null || cell.carriedOffsetY === null) {
    return;
  }
  placeCarriedCell(predator, world, placed);
  cell.x = predator.x + cell.carriedOffsetX;
  cell.y = predator.y + cell.carriedOffsetY;
  cell.velocityX = predator.velocityX;
  cell.velocityY = predator.velocityY;
}

export function moveCells(world: WorldState, context: StepContext): void {
  for (const cell of world.cells) {
    if (!isCarried(cell)) {
      moveCell(cell, world, context.balance);
    }
  }
  const placed = new Set<CellRecord>();
  for (const cell of world.cells) {
    if (isCarried(cell)) {
      placeCarriedCell(cell, world, placed);
    }
  }
  separateOverlappingCells(world, context.balance);
  restorePins(world);
}
