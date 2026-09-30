// The wild hunt's aim, re-resolved every tick (docs/ecology/wild-cells.md §3.3.3, ticket #738): a decision picks the
// prey and keeps its id in the seat (`huntPreyId`); every tick until the next decision the seat's target is resolved
// again from the prey's current place and the contact, instead of a point latched at the decision:
//
//   out of contact                                  the prey's centre
//   touching, not engulfing, not covering its centre  `WILD_CELL_HUNT_CHARGE_RADII` own radii past it (the charge:
//                                                   it keeps moving in through the contact, so the engulf starts)
//   touching and engulfing, or covering its centre  the hold: the target that steers the cell onto the prey at the
//                                                   prey's own velocity, critically damped, so it neither coasts out
//                                                   the far side (aiming at the centre would: the steer dead zone
//                                                   gives no braking) nor falls behind a prey that drifts
//
// No randomness; one lookup per hunting seat per tick.

import { distanceBetween, type BalanceConfig, type Vec2 } from '@evolution/shared';
import { huntTargetFrom } from '../bots/strategies/hunter.js';
import { isEngulfContact } from '../simulation/contact.js';
import { isEngulfing } from '../simulation/engulf-state.js';
import { speedCapOf } from '../simulation/movement.js';
import type { CellRecord, WildSeatRecord } from '../world/entities.js';
import { findCell } from '../world/lookups.js';
import type { WorldState } from '../world/world-state.js';

/** Out of contact: the prey's own centre. */
const AIM_AT_CENTRE_RADII = 0;
/** The throttle the steer ramp never exceeds. */
const FULL_THROTTLE = 1;

/** Whether the two cells touch: their centres are within the sum of their radii. */
export function isInContact(self: CellRecord, other: CellRecord): boolean {
  return distanceBetween(self, other) <= self.radius + other.radius;
}

/** Whether a hunter touching `prey` charges past it: only to start an engulf, so not once one runs or would start. */
export function isHuntCharging(self: CellRecord, prey: CellRecord, balance: BalanceConfig): boolean {
  return isInContact(self, prey) && !isEngulfing(self) && !isEngulfContact(self, prey, balance);
}

/** The cell's steer time constant: the seconds its velocity takes to close the gap to the commanded one by 1 − 1/e. */
function accelerationSecondsOf(cell: CellRecord, balance: BalanceConfig): number {
  return balance.growth.CELL_ACCELERATION_SECONDS * cell.modifiers.accelerationSecondsMultiplier;
}

/**
 * The velocity the hold commands (wu/s): the prey's own plus the gap to the prey less the relative velocity's coast,
 * over the steer time constant. With the steer's first-order response this closes the gap critically damped.
 */
export function holdVelocityOf(self: CellRecord, prey: CellRecord, balance: BalanceConfig): Vec2 {
  const seconds = accelerationSecondsOf(self, balance);
  const gapX = prey.x - self.x - (self.velocityX - prey.velocityX) * seconds;
  const gapY = prey.y - self.y - (self.velocityY - prey.velocityY) * seconds;
  return { x: prey.velocityX + gapX / seconds, y: prey.velocityY + gapY / seconds };
}

/**
 * The target that commands `velocity`: along it, at the distance the steer ramp (docs/ecology/mass-and-movement.md
 * §5.2) turns into that share of the speed cap; the cell's own centre (no steer) for no velocity.
 */
function targetCommanding(self: CellRecord, velocity: Vec2, speedCap: number, balance: BalanceConfig): Vec2 {
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed === 0) {
    return { x: self.x, y: self.y };
  }
  const { controls } = balance;
  const throttle = Math.min(FULL_THROTTLE, speed / speedCap);
  const radii =
    controls.STEER_DEAD_ZONE_RADII + throttle * (controls.STEER_FULL_THROTTLE_RADII - controls.STEER_DEAD_ZONE_RADII);
  const distance = radii * self.radius;
  return { x: self.x + (velocity.x / speed) * distance, y: self.y + (velocity.y / speed) * distance };
}

/** Where a hunter aims at `prey` this tick: at it, charging past it, or holding over it (the table above). */
export function huntTargetThisTick(self: CellRecord, prey: CellRecord, world: WorldState, balance: BalanceConfig) {
  if (!isInContact(self, prey)) {
    return huntTargetFrom(self, prey, AIM_AT_CENTRE_RADII);
  }
  if (isHuntCharging(self, prey, balance)) {
    return huntTargetFrom(self, prey, balance.wildCells.WILD_CELL_HUNT_CHARGE_RADII);
  }
  return targetCommanding(self, holdVelocityOf(self, prey, balance), speedCapOf(self, world, balance), balance);
}

/**
 * Re-aims a hunting seat's cell at its prey for this tick. A prey that has left the world ends the hunt: the target
 * stays where it last was until the next decision.
 */
export function aimWildHunt(seat: WildSeatRecord, cell: CellRecord, world: WorldState, balance: BalanceConfig): void {
  if (seat.huntPreyId === null) {
    return;
  }
  const prey = findCell(world, seat.huntPreyId);
  if (prey === undefined) {
    seat.huntPreyId = null;
    return;
  }
  const target = huntTargetThisTick(cell, prey, world, balance);
  cell.targetX = target.x;
  cell.targetY = target.y;
}
