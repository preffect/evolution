// Which zone a point is in (docs/ecology/food-and-spawn.md §2) and what the zone does to decay
// (docs/ecology/mass-and-movement.md §4). Shared because the HUD's zone pill and the renderer read the same
// precedence the server's metabolism, movement and spawners use (docs/ui/hud.md §3.1.5, #383); the band geometry
// and the gel placement stay the server's (`game/simulation/zones.ts`). The zones follow the world the era has built
// (docs/game-design/phases.md §14.5.2): the dish's annulus, vent and gel patches, then, from the pool's move, the
// pool's one sunlit zone, its light patch, whose centre moves with the tick.

import type { BalanceConfig } from '../constants/balance.js';
import type { Vec2 } from '../types/common.js';
import { GAME_ERA, ZONE_ID, type GameEra, type GelPatchView, type ZoneId } from '../types/game.js';
import type { PoolLayoutView } from '../types/pool.js';
import { lightPatchCentreAt } from './pool-layout.js';
import { distanceBetween } from './vector-math.js';

/** Outside the vent the zone leaves decay as it is. */
const NO_ZONE_DECAY_MULTIPLIER = 1;

/**
 * What a point's zone reads besides the point, on one tick: the dish's gel patches, and the light patch's centre once
 * the world is in the pool (null in the dish, where the shallows' annulus and the vent hold instead).
 */
export interface ZoneMap {
  readonly gelPatches: readonly GelPatchView[];
  readonly lightPatchCentre: Vec2 | null;
}

/** What the zone map is built from: the server's world and the client's snapshot both carry these. */
export interface ZoneMapSource {
  /** The era the world has moved into (the world's `eraMovedInto`, the snapshot's `era`). */
  readonly era: GameEra;
  readonly gelPatches: readonly GelPatchView[];
  readonly poolLayout: PoolLayoutView | null;
}

/** The dish's zones over `gelPatches`: the map of every world before the pool's move. */
export function dishZoneMap(gelPatches: readonly GelPatchView[]): ZoneMap {
  return { gelPatches, lightPatchCentre: null };
}

/**
 * The zones on `tick` (a whole world tick, or the client's fractional render tick): the dish's until the world has
 * moved past the dish, then the pool's, its light patch where `lightPatchCentreAt` puts it. A world past the dish
 * always holds a layout (the move draws one when none was drawn); without one the dish's zones stand.
 */
export function zoneMapAt(source: ZoneMapSource, tick: number, balance: BalanceConfig): ZoneMap {
  if (source.era === GAME_ERA.dish || source.poolLayout === null) {
    return dishZoneMap(source.gelPatches);
  }
  return {
    gelPatches: source.gelPatches,
    lightPatchCentre: lightPatchCentreAt(source.poolLayout.lightPatchOrbit, tick, balance),
  };
}

/** Where the broth ends and the shallows begin: `DISH_RADIUS − SHALLOWS_WIDTH` (docs/ecology/food-and-spawn.md §2). */
export function shallowsInnerRadius(balance: BalanceConfig): number {
  return balance.world.DISH_RADIUS - balance.ecology.SHALLOWS_WIDTH;
}

export function isInsideGelPatch(point: Vec2, gelPatches: readonly GelPatchView[]): boolean {
  return gelPatches.some((patch) => distanceBetween(point, patch) <= patch.radius);
}

/** The dish's zones: the first in `ZONE_ID` order containing the point (docs/ecology/food-and-spawn.md §2). */
function dishZoneAt(point: Vec2, gelPatches: readonly GelPatchView[], balance: BalanceConfig): ZoneId {
  const distance = Math.hypot(point.x, point.y);
  if (distance >= shallowsInnerRadius(balance)) {
    return ZONE_ID.sunlitShallows;
  }
  if (distance <= balance.ecology.VENT_RADIUS) {
    return ZONE_ID.warmVent;
  }
  return isInsideGelPatch(point, gelPatches) ? ZONE_ID.viscousGel : ZONE_ID.openBroth;
}

/**
 * The pool's zones (phases.md §14.5.2): the light patch, a disc of `POOL_LIGHT_PATCH_RADIUS` (rim included), is its
 * `sunlit_shallows`; the rest is open water. The dish's vent and gel do not follow the players into the pool.
 */
function poolZoneAt(point: Vec2, lightPatchCentre: Vec2, balance: BalanceConfig): ZoneId {
  const isLit = distanceBetween(point, lightPatchCentre) <= balance.pool.POOL_LIGHT_PATCH_RADIUS;
  return isLit ? ZONE_ID.sunlitShallows : ZONE_ID.openBroth;
}

/** The zone containing the point on the map's tick: the dish's precedence, or the pool's light patch. */
export function zoneAt(point: Vec2, zones: ZoneMap, balance: BalanceConfig): ZoneId {
  return zones.lightPatchCentre === null
    ? dishZoneAt(point, zones.gelPatches, balance)
    : poolZoneAt(point, zones.lightPatchCentre, balance);
}

/** `VENT_DECAY_MULTIPLIER` in the vent, 1 elsewhere (docs/ecology/mass-and-movement.md §4). */
export function zoneDecayMultiplier(zone: ZoneId, balance: BalanceConfig): number {
  return zone === ZONE_ID.warmVent ? balance.ecology.VENT_DECAY_MULTIPLIER : NO_ZONE_DECAY_MULTIPLIER;
}
