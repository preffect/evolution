// docs/ecology/food-and-spawn.md §2: zone geometry and gel placement (the precedence is shared's `zones.test.ts`).
import { describe, expect, it } from 'vitest';
import {
  createSeededRandom,
  DEFAULT_BALANCE,
  ZONE_ID,
  shallowsInnerRadius,
  type BalanceConfig,
} from '@evolution/shared';
import { SimulationInvariantError } from '../world/simulation-invariant-error.js';
import { placeGelPatches, pointInZone, zoneBand } from './zones.js';

const balance = DEFAULT_BALANCE;
const { ecology, world } = balance;
const SEED = 42;

describe('zoneBand', () => {
  it('gives the shallows annulus, the vent disc and the broth between them', () => {
    expect(shallowsInnerRadius(balance)).toBe(world.DISH_RADIUS - ecology.SHALLOWS_WIDTH);
    expect(zoneBand(ZONE_ID.sunlitShallows, balance)).toEqual({
      innerRadius: shallowsInnerRadius(balance),
      outerRadius: world.DISH_RADIUS,
    });
    expect(zoneBand(ZONE_ID.warmVent, balance)).toEqual({ innerRadius: 0, outerRadius: ecology.VENT_RADIUS });
    expect(zoneBand(ZONE_ID.openBroth, balance)).toEqual({
      innerRadius: ecology.VENT_RADIUS,
      outerRadius: world.DISH_RADIUS - ecology.SHALLOWS_WIDTH,
    });
  });
});

describe('pointInZone', () => {
  it('lands inside the zone band for the extreme draws', () => {
    for (const zone of [ZONE_ID.sunlitShallows, ZONE_ID.warmVent, ZONE_ID.openBroth] as const) {
      const band = zoneBand(zone, balance);
      expect(Math.hypot(...Object.values(pointInZone(zone, balance, 0, 0.3)))).toBeCloseTo(band.innerRadius, 9);
      expect(Math.hypot(...Object.values(pointInZone(zone, balance, 1, 0.7)))).toBeCloseTo(band.outerRadius, 9);
    }
  });
});

describe('placeGelPatches', () => {
  it('places GEL_PATCH_COUNT patches in the broth, apart, deterministically', () => {
    const patches = placeGelPatches(createSeededRandom(SEED), balance);
    expect(patches).toHaveLength(ecology.GEL_PATCH_COUNT);
    for (const patch of patches) {
      const distance = Math.hypot(patch.x, patch.y);
      expect(distance).toBeGreaterThanOrEqual(ecology.VENT_RADIUS + ecology.GEL_PATCH_RADIUS);
      expect(distance).toBeLessThanOrEqual(world.DISH_RADIUS - ecology.SHALLOWS_WIDTH - ecology.GEL_PATCH_RADIUS);
    }
    expect(Math.hypot(patches[0]!.x - patches[1]!.x, patches[0]!.y - patches[1]!.y)).toBeGreaterThanOrEqual(
      ecology.GEL_PATCH_MIN_SPACING,
    );
    expect(placeGelPatches(createSeededRandom(SEED), balance)).toEqual(patches);
  });

  it('throws an invariant error when the spacing cannot fit the broth', () => {
    const impossible: BalanceConfig = structuredClone(balance);
    impossible.ecology.GEL_PATCH_MIN_SPACING = world.DISH_RADIUS * 10;
    expect(() => placeGelPatches(createSeededRandom(SEED), impossible)).toThrow(SimulationInvariantError);
  });
});
