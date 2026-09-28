// The arm grab (docs/ecology/absorption.md §6.1 "the arm grab", #735): a cell with arms (`armGrabReachRadii`, the
// amoeba) starts and holds an engulf from its arm's reach, not only its body's, and the arm draws the held prey in
// toward the body. The arms' angles are the renderer's (they run on its clock), so the reach is the same all round:
// the arm's shortest reach past the body, which every arm holds at every moment of its cycle. Contact and separation
// stay the body's, and so does the seal: the body must cover the prey before it closes.

import { TICK_INTERVAL_S, secondsToTicks, type BalanceConfig, type EntityId } from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';
import { engulfContactGap, type CellFootprint } from './contact.js';
import { drawPreyTowardPredator } from './engulf-drag.js';
import type { EngulfPairing } from './engulf-state.js';
import { hasLiveRefractory, rememberRefractory } from './engulf-spit-out.js';
import { speedCapOf } from './movement.js';

/** `armGrabReachRadii` of a cell without arms. */
const NO_ARM_REACH_RADII = 0;

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
 * How far the arm draws a prey this tick (wu): `ENGULF_ARM_PULL_RADII_PER_SECOND` predator radii a second, but never
 * more than `ENGULF_ARM_PULL_MAX_PREY_SPEED_SHARE` of the prey's own speed cap, so a prey that swims away gains.
 */
export function armPullPerTick(pairing: EngulfPairing, world: WorldState, balance: BalanceConfig): number {
  const absorption = balance.absorption;
  const pullWuPerSecond = Math.min(
    absorption.ENGULF_ARM_PULL_RADII_PER_SECOND * pairing.predator.radius,
    absorption.ENGULF_ARM_PULL_MAX_PREY_SPEED_SHARE * speedCapOf(pairing.prey, world, balance),
  );
  return pullWuPerSecond * TICK_INTERVAL_S;
}

/**
 * The arm draws a prey it holds outside body contact toward the predator's centre by `armPullPerTick`, then the dish
 * wall: the last tick's pull may carry the prey a step inside the body's contact, never a step short of it. A prey in
 * body contact, or out of the arm's reach, or a predator without arms, is left where it is.
 */
export function pullPreyByArm(pairing: EngulfPairing, world: WorldState, balance: BalanceConfig): void {
  const { predator, prey } = pairing;
  if (engulfContactGap(predator, prey, balance) <= 0 || !isGrabContact(predator, prey, balance)) {
    return;
  }
  drawPreyTowardPredator(pairing, armPullPerTick(pairing, world, balance), balance);
}

/** The re-grab cooldown (#735): this predator may not grab this prey by the arm alone yet; the body still may. */
export function hasArmRegrabRefractory(predator: CellRecord, preyCellId: EntityId, tick: number): boolean {
  return hasLiveRefractory(predator.armRegrabRefractories, preyCellId, tick);
}

/**
 * A prey that escaped a predator with arms starts that predator's re-grab cooldown on it,
 * `ENGULF_ARM_REGRAB_COOLDOWN_SECONDS`, so a prey whose steering wobbles around "away" is not grabbed and dropped
 * several times a second. A predator without arms keeps no entry.
 */
export function recordArmRegrabRefractory(world: WorldState, pairing: EngulfPairing, balance: BalanceConfig): void {
  if (pairing.predator.modifiers.armGrabReachRadii <= NO_ARM_REACH_RADII) {
    return;
  }
  const untilTick = world.tick + secondsToTicks(balance.absorption.ENGULF_ARM_REGRAB_COOLDOWN_SECONDS);
  rememberRefractory(pairing.predator.armRegrabRefractories, pairing.prey.id, untilTick);
}
