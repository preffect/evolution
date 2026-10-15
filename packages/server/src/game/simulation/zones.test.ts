// docs/ecology/food-and-spawn.md §2: zone geometry and gel placement (the precedence is shared's `zones.test.ts`);
// docs/game-design/phases.md §14.5.2: the world's zones follow the era it has moved into.
import { describe, expect, it } from 'vitest';
import {
  createSeededRandom,
  createTestPoolLayout,
  DEFAULT_BALANCE,
  GAME_ERA,
  lightPatchCentreAt,
  ZONE_ID,
  shallowsInnerRadius,
  type BalanceConfig,
} from '@evolution/shared';
import { SimulationInvariantError } from '../world/simulation-invariant-error.js';
import { createTestWorldInEras } from '../../testing/world-builders.js';
import { clampedToFoodBoundary, placeGelPatches, pointInZone, worldZoneMap, zoneBand } from './zones.js';

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

describe('clampedToFoodBoundary', () => {
  const reach = world.DISH_RADIUS - world.FOOD_EDGE_MARGIN;

  it('returns a point inside the boundary unchanged', () => {
    const inside = { x: reach - 1, y: 0 };
    expect(clampedToFoodBoundary(inside, balance)).toBe(inside);
  });

  it('projects a point past the boundary onto it along its bearing', () => {
    const clamped = clampedToFoodBoundary({ x: 0, y: -(world.DISH_RADIUS + 10) }, balance);
    expect(clamped.x).toBeCloseTo(0);
    expect(clamped.y).toBeCloseTo(-reach);
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

describe('worldZoneMap', () => {
  const moveTick = 36_000;

  it('is the dish’s, its gel patches and no light patch, until the world has moved into the pool', () => {
    const world = createTestWorldInEras();
    expect(world.poolLayout).not.toBeNull();
    expect(worldZoneMap(world)).toEqual({ gelPatches: world.gelPatches, lightPatchCentre: null });
  });

  it('from the move, puts the light patch where the layout’s orbit has it on the world’s tick', () => {
    const world = createTestWorldInEras();
    world.eraMovedInto = GAME_ERA.pool;
    world.poolLayout = createTestPoolLayout();
    world.tick = moveTick;
    expect(worldZoneMap(world).lightPatchCentre).toEqual(
      lightPatchCentreAt(world.poolLayout.lightPatchOrbit, moveTick, balance),
    );
  });
});
