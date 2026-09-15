// Zones (docs/ecology/food-and-spawn.md §2): geometry fixed by the dish radius, gel patches placed from the
// `zones` stream at world creation; gel patches never overlap the vent or the shallows by construction. Which zone
// a point is in (`zoneAt`) and its decay multiplier are shared (`@evolution/shared` `simulation/zones.ts`, #383).

import {
  GEL_PATCH_PLACEMENT_MAX_ATTEMPTS,
  ZONE_ID,
  distanceBetween,
  shallowsInnerRadius,
  uniformPointInAnnulus,
  type BalanceConfig,
  type GelPatchView,
  type RandomSource,
  type SpawnZoneId,
  type Vec2,
} from '@evolution/shared';
import { SimulationInvariantError } from '../world/simulation-invariant-error.js';

/** The radial band of a spawn zone: the shallows annulus, the vent disc or the broth between them. */
export interface RadialBand {
  readonly innerRadius: number;
  readonly outerRadius: number;
}

export function zoneBand(zone: SpawnZoneId, balance: BalanceConfig): RadialBand {
  const brothOuterRadius = shallowsInnerRadius(balance);
  const ventRadius = balance.ecology.VENT_RADIUS;
  switch (zone) {
    case ZONE_ID.sunlitShallows:
      return { innerRadius: brothOuterRadius, outerRadius: balance.world.DISH_RADIUS };
    case ZONE_ID.warmVent:
      return { innerRadius: 0, outerRadius: ventRadius };
    case ZONE_ID.openBroth:
      return { innerRadius: ventRadius, outerRadius: brothOuterRadius };
    default: {
      const unknownZone: never = zone;
      throw new SimulationInvariantError(`no spawn band for zone ${String(unknownZone)}`);
    }
  }
}

/** Food never spawns or drifts nearer than `FOOD_EDGE_MARGIN` to the wall (docs/game-design/controls-and-scope.md §8). */
export function foodBoundaryRadius(balance: BalanceConfig): number {
  return balance.world.DISH_RADIUS - balance.world.FOOD_EDGE_MARGIN;
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
