// The arm grab (docs/ecology/absorption.md §6.1 "the arm grab", #735): a cell with arms (`armGrabReachRadii`, the
// amoeba) starts and holds an engulf from its arm's reach, not only its body's, and the arm draws the held prey in
// toward the body. The arms' angles are the renderer's (they run on its clock), so the reach is the same all round:
// the arm's shortest reach past the body, which every arm holds at every moment of its cycle. Contact and separation
// stay the body's, and so does the seal: the body must cover the prey before it closes.

import { TICK_INTERVAL_S, distanceBetween, type BalanceConfig } from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';
import { engulfContactGap, type CellFootprint } from './contact.js';
import { keepInsideDish } from './dish-wall.js';
import type { EngulfPairing } from './engulf-state.js';

/** What the grab reads of the predator: its footprint and how far its arms reach past it. */
export type GrabbingCell = CellFootprint & { readonly modifiers: Pick<CellRecord['modifiers'], 'armGrabReachRadii'> };

/** How far the predator still is from grabbing the prey (wu): body contact, less the arm's reach past the body. */
export function grabContactGap(predator: GrabbingCell, prey: CellFootprint, balance: BalanceConfig): number {
  return engulfContactGap(predator, prey, balance) - predator.radius * predator.modifiers.armGrabReachRadii;
}

/** The prey's centre is within the predator's grab: its body's engulf contact, or its arm's (a cell without arms: the body's alone). */
export function isGrabContact(predator: GrabbingCell, prey: CellFootprint, balance: BalanceConfig): boolean {
  return grabContactGap(predator, prey, balance) <= 0;
}

/**
 * The arm draws a prey it holds outside body contact toward the predator's centre, `ENGULF_ARM_PULL_RADII_PER_SECOND`
 * predator radii a second, then the dish wall: the last tick's pull may carry the prey a step inside the body's
 * contact, never a step short of it. A prey in body contact, or out of the arm's reach, or a predator without arms, is
 * left where it is.
 */
export function pullPreyByArm(pairing: EngulfPairing, balance: BalanceConfig): void {
  const { predator, prey } = pairing;
  if (engulfContactGap(predator, prey, balance) <= 0 || !isGrabContact(predator, prey, balance)) {
    return;
  }
  const distance = distanceBetween(predator, prey);
  const pullPerTick = balance.absorption.ENGULF_ARM_PULL_RADII_PER_SECOND * predator.radius * TICK_INTERVAL_S;
  const share = Math.min(pullPerTick, distance) / distance;
  prey.x -= (prey.x - predator.x) * share;
  prey.y -= (prey.y - predator.y) * share;
  keepInsideDish(prey, balance.world.DISH_RADIUS);
}
