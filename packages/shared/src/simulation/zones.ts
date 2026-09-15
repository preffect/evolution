// Which zone a point is in (docs/ecology/food-and-spawn.md §2) and what the zone does to decay
// (docs/ecology/mass-and-movement.md §4). Shared because the HUD's zone pill and the renderer read the same
// precedence the server's metabolism, movement and spawners use (docs/ui/hud.md §3.1.5, #383); the band geometry
// and the gel placement stay the server's (`game/simulation/zones.ts`).

import type { BalanceConfig } from '../constants/balance.js';
import type { Vec2 } from '../types/common.js';
import { ZONE_ID, type GelPatchView, type ZoneId } from '../types/game.js';
import { distanceBetween } from './vector-math.js';

/** Outside the vent the zone leaves decay as it is. */
const NO_ZONE_DECAY_MULTIPLIER = 1;

/** Where the broth ends and the shallows begin: `DISH_RADIUS − SHALLOWS_WIDTH` (docs/ecology/food-and-spawn.md §2). */
export function shallowsInnerRadius(balance: BalanceConfig): number {
  return balance.world.DISH_RADIUS - balance.ecology.SHALLOWS_WIDTH;
}

export function isInsideGelPatch(point: Vec2, gelPatches: readonly GelPatchView[]): boolean {
  return gelPatches.some((patch) => distanceBetween(point, patch) <= patch.radius);
}

/** The first zone in `ZONE_ID` order containing the point (docs/ecology/food-and-spawn.md §2). */
export function zoneAt(point: Vec2, gelPatches: readonly GelPatchView[], balance: BalanceConfig): ZoneId {
  const distance = Math.hypot(point.x, point.y);
  if (distance >= shallowsInnerRadius(balance)) {
    return ZONE_ID.sunlitShallows;
  }
  if (distance <= balance.ecology.VENT_RADIUS) {
    return ZONE_ID.warmVent;
  }
  return isInsideGelPatch(point, gelPatches) ? ZONE_ID.viscousGel : ZONE_ID.openBroth;
}

/** `VENT_DECAY_MULTIPLIER` in the vent, 1 elsewhere (docs/ecology/mass-and-movement.md §4). */
export function zoneDecayMultiplier(zone: ZoneId, balance: BalanceConfig): number {
  return zone === ZONE_ID.warmVent ? balance.ecology.VENT_DECAY_MULTIPLIER : NO_ZONE_DECAY_MULTIPLIER;
}
