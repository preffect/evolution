// Zones (docs/ECOLOGY.md §2): geometry fixed by the dish radius, gel patches placed from the
// `zones` stream at world creation. A point belongs to the first zone, in `ZONE_ID` order, that
// contains it; gel patches never overlap the vent or the shallows by construction.

import {
  GEL_PATCH_PLACEMENT_MAX_ATTEMPTS,
  ZONE_ID,
  distanceBetween,
  uniformPointInAnnulus,
  type BalanceConfig,
  type GelPatchView,
  type RandomSource,
  type SpawnZoneId,
  type Vec2,
  type ZoneId,
} from '@evolution/shared';
import { SimulationInvariantError } from '../world/lookups.js';

/** The radial band of a spawn zone: the shallows annulus, the vent disc or the broth between them. */
export interface RadialBand {
  readonly innerRadius: number;
  readonly outerRadius: number;
}

export function zoneBand(zone: SpawnZoneId, balance: BalanceConfig): RadialBand {
  const dishRadius = balance.world.DISH_RADIUS;
  const brothOuterRadius = dishRadius - balance.ecology.SHALLOWS_WIDTH;
  const ventRadius = balance.ecology.VENT_RADIUS;
  switch (zone) {
    case ZONE_ID.sunlitShallows:
      return { innerRadius: brothOuterRadius, outerRadius: dishRadius };
    case ZONE_ID.warmVent:
      return { innerRadius: 0, outerRadius: ventRadius };
    default:
      return { innerRadius: ventRadius, outerRadius: brothOuterRadius };
  }
}

/** Food never spawns or drifts nearer than `FOOD_EDGE_MARGIN` to the wall (docs/GAME-DESIGN.md §8). */
export function foodBoundaryRadius(balance: BalanceConfig): number {
  return balance.world.DISH_RADIUS - balance.world.FOOD_EDGE_MARGIN;
}

export function isInsideGelPatch(point: Vec2, gelPatches: readonly GelPatchView[]): boolean {
  return gelPatches.some((patch) => distanceBetween(point, patch) <= patch.radius);
}

/** The first zone in `ZONE_ID` order containing the point (docs/ECOLOGY.md §2). */
export function zoneAt(point: Vec2, gelPatches: readonly GelPatchView[], balance: BalanceConfig): ZoneId {
  const distance = Math.hypot(point.x, point.y);
  if (distance >= balance.world.DISH_RADIUS - balance.ecology.SHALLOWS_WIDTH) {
    return ZONE_ID.sunlitShallows;
  }
  if (distance <= balance.ecology.VENT_RADIUS) {
    return ZONE_ID.warmVent;
  }
  return isInsideGelPatch(point, gelPatches) ? ZONE_ID.viscousGel : ZONE_ID.openBroth;
}

/** `VENT_DECAY_MULTIPLIER` in the vent, 1 elsewhere (docs/ECOLOGY.md §4). */
export function zoneDecayMultiplier(zone: ZoneId, balance: BalanceConfig): number {
  return zone === ZONE_ID.warmVent ? balance.ecology.VENT_DECAY_MULTIPLIER : 1;
}

/** A point uniform by area in the zone's band, from two draws. */
export function pointInZone(zone: SpawnZoneId, balance: BalanceConfig, unitRadial: number, unitAngle: number): Vec2 {
  const band = zoneBand(zone, balance);
  return uniformPointInAnnulus(band.innerRadius, band.outerRadius, unitRadial, unitAngle);
}

function isGelCentreAllowed(centre: Vec2, placed: readonly GelPatchView[], balance: BalanceConfig): boolean {
  return placed.every((patch) => distanceBetween(centre, patch) >= balance.ecology.GEL_PATCH_MIN_SPACING);
}

/**
 * `GEL_PATCH_COUNT` discs of `GEL_PATCH_RADIUS`, centres uniform in the broth band shrunk by the
 * patch radius (so no patch touches the vent or the shallows), at least `GEL_PATCH_MIN_SPACING` apart.
 */
export function placeGelPatches(random: RandomSource, balance: BalanceConfig): GelPatchView[] {
  const patchRadius = balance.ecology.GEL_PATCH_RADIUS;
  const broth = zoneBand(ZONE_ID.openBroth, balance);
  const band: RadialBand = {
    innerRadius: broth.innerRadius + patchRadius,
    outerRadius: broth.outerRadius - patchRadius,
  };
  const patches: GelPatchView[] = [];
  while (patches.length < balance.ecology.GEL_PATCH_COUNT) {
    const centre = drawGelCentre(random, band, patches, balance);
    patches.push({ x: centre.x, y: centre.y, radius: patchRadius });
  }
  return patches;
}

function drawGelCentre(
  random: RandomSource,
  band: RadialBand,
  placed: readonly GelPatchView[],
  balance: BalanceConfig,
): Vec2 {
  for (let attempt = 0; attempt < GEL_PATCH_PLACEMENT_MAX_ATTEMPTS; attempt += 1) {
    const centre = uniformPointInAnnulus(band.innerRadius, band.outerRadius, random.nextFloat(), random.nextFloat());
    if (isGelCentreAllowed(centre, placed, balance)) {
      return centre;
    }
  }
  throw new SimulationInvariantError(
    `no gel patch centre found in ${GEL_PATCH_PLACEMENT_MAX_ATTEMPTS} draws: the spacing does not fit the broth`,
  );
}
