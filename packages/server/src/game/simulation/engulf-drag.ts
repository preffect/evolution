// The drag (docs/ecology/absorption.md §6.1 "the drag", #772): once an engulf has started, a predator moving off its
// prey draws the prey after it, so a pass over a prey at speed carries it instead of coasting out the far side. The
// drag answers the predator's own move only: the gap it measures is between the prey where it is now and the predator
// before and after its move this tick, so whatever the prey swam itself stays swum, and a prey swimming away escapes
// exactly as it would from a still predator (decision #139).

import { TICK_INTERVAL_S, distanceBetween, type BalanceConfig } from '@evolution/shared';
import { keepInsideDish } from './dish-wall.js';
import type { EngulfPairing } from './engulf-state.js';

/**
 * How far the predator's own move this tick carried it away from the prey (wu, 0 when it moved toward the prey): the
 * prey's current centre against the predator's centre now and one tick of its velocity back. The velocity is the
 * movement kernel's, so a push from separation is not the predator's move; at the dish wall, whose clamp drops the
 * outward velocity, the start is an approximation within one tick's move.
 */
export function gapOpenedByPredator(pairing: EngulfPairing): number {
  const { predator, prey } = pairing;
  const startX = predator.x - predator.velocityX * TICK_INTERVAL_S;
  const startY = predator.y - predator.velocityY * TICK_INTERVAL_S;
  const distanceBefore = Math.hypot(prey.x - startX, prey.y - startY);
  return Math.max(0, distanceBetween(predator, prey) - distanceBefore);
}

/**
 * Moves the held prey `distanceWu` toward its predator's centre, never past it, then the dish wall: the one way a hold
 * draws a prey in, shared by the drag and the amoeba's arm (`engulf-arm-grab.ts`). A prey on the centre stays there.
 */
export function drawPreyTowardPredator(pairing: EngulfPairing, distanceWu: number, balance: BalanceConfig): void {
  const { predator, prey } = pairing;
  const distance = distanceBetween(predator, prey);
  if (distanceWu <= 0 || distance === 0) {
    return;
  }
  const share = Math.min(distanceWu, distance) / distance;
  prey.x -= (prey.x - predator.x) * share;
  prey.y -= (prey.y - predator.y) * share;
  keepInsideDish(prey, balance.world.DISH_RADIUS);
}

/**
 * Draws the prey toward the predator's centre by `ENGULF_DRAG_SHARE` of the gap the predator's move opened this tick.
 * A predator that moved toward its prey, or sits on its centre, leaves it where it is.
 */
export function dragPreyAlong(pairing: EngulfPairing, balance: BalanceConfig): void {
  drawPreyTowardPredator(pairing, balance.absorption.ENGULF_DRAG_SHARE * gapOpenedByPredator(pairing), balance);
}
