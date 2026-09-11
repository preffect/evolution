// docs/ECOLOGY.md §2: zone geometry, precedence and gel placement.
import { describe, expect, it } from 'vitest';
import { createSeededRandom, DEFAULT_BALANCE, ZONE_ID, type BalanceConfig, type GelPatchView } from '@evolution/shared';
import { SimulationInvariantError } from '../world/lookups.js';
import { isInsideGelPatch, placeGelPatches, pointInZone, zoneAt, zoneBand, zoneDecayMultiplier } from './zones.js';

const balance = DEFAULT_BALANCE;
const { ecology, world } = balance;
const SEED = 42;
const gelPatch: GelPatchView = { x: 1500, y: 0, radius: ecology.GEL_PATCH_RADIUS };

describe('zoneBand', () => {
  it('gives the shallows annulus, the vent disc and the broth between them', () => {
    expect(zoneBand(ZONE_ID.sunlitShallows, balance)).toEqual({
      innerRadius: world.DISH_RADIUS - ecology.SHALLOWS_WIDTH,
      outerRadius: world.DISH_RADIUS,
    });
    expect(zoneBand(ZONE_ID.warmVent, balance)).toEqual({ innerRadius: 0, outerRadius: ecology.VENT_RADIUS });
    expect(zoneBand(ZONE_ID.openBroth, balance)).toEqual({
      innerRadius: ecology.VENT_RADIUS,
      outerRadius: world.DISH_RADIUS - ecology.SHALLOWS_WIDTH,
    });
  });
});

describe('zoneAt', () => {
  it('resolves shallows, then vent, then gel, then broth', () => {
    expect(zoneAt({ x: 2750, y: 0 }, [gelPatch], balance)).toBe(ZONE_ID.sunlitShallows);
    expect(zoneAt({ x: 2500, y: 0 }, [gelPatch], balance)).toBe(ZONE_ID.sunlitShallows);
    expect(zoneAt({ x: 0, y: 0 }, [gelPatch], balance)).toBe(ZONE_ID.warmVent);
    expect(zoneAt({ x: 0, y: 500 }, [gelPatch], balance)).toBe(ZONE_ID.warmVent);
    expect(zoneAt({ x: 1500, y: 100 }, [gelPatch], balance)).toBe(ZONE_ID.viscousGel);
    expect(zoneAt({ x: 1500, y: 0 }, [], balance)).toBe(ZONE_ID.openBroth);
    expect(zoneAt({ x: 1500, y: 351 }, [gelPatch], balance)).toBe(ZONE_ID.openBroth);
  });

  it('isInsideGelPatch is inclusive at the rim', () => {
    expect(isInsideGelPatch({ x: 1500 + ecology.GEL_PATCH_RADIUS, y: 0 }, [gelPatch])).toBe(true);
    expect(isInsideGelPatch({ x: 1500 + ecology.GEL_PATCH_RADIUS + 0.01, y: 0 }, [gelPatch])).toBe(false);
  });
});

describe('zoneDecayMultiplier', () => {
  it('is the vent multiplier in the vent and 1 elsewhere', () => {
    expect(zoneDecayMultiplier(ZONE_ID.warmVent, balance)).toBe(ecology.VENT_DECAY_MULTIPLIER);
    for (const zone of [ZONE_ID.openBroth, ZONE_ID.viscousGel, ZONE_ID.sunlitShallows]) {
      expect(zoneDecayMultiplier(zone, balance)).toBe(1);
    }
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
