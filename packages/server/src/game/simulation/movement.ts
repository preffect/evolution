// Step 3 (docs/ECOLOGY.md §5.2): the shared kernel per cell with the speed cap folded from the
// mass curve, the sprint, the zone and the traits; the sprint counters tick down; then
// separation (contact.ts) and the fixture pins are restored.

import {
  gelSpeedFactor,
  maxSpeedForMass,
  stepMovementKernel,
  steerBlendPerTick,
  TICK_INTERVAL_S,
  ZONE_ID,
  type BalanceConfig,
} from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { separateOverlappingCells } from './contact.js';
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

/**
 * `maxSpeed(mass) × sprint × zone × trait` (wu/s). The engulf factor of docs/ECOLOGY.md §6.1
 * multiplies in here with the engulf slice; until then it is 1.
 */
export function speedCapOf(cell: CellRecord, world: WorldState, balance: BalanceConfig): number {
  return (
    maxSpeedForMass(cell.mass, balance.growth) *
    sprintSpeedFactor(cell, balance) *
    zoneSpeedFactor(cell, world, balance) *
    cell.modifiers.speedMultiplier
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

export function moveCells(world: WorldState, context: StepContext): void {
  for (const cell of world.cells) {
    moveCell(cell, world, context.balance);
  }
  separateOverlappingCells(world, context.balance);
  restorePins(world);
}
