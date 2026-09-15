// docs/ecology/food-and-spawn.md §2: zone precedence; docs/ecology/mass-and-movement.md §4: the zone's decay.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { ZONE_ID, type GelPatchView } from '../types/game.js';
import { isInsideGelPatch, shallowsInnerRadius, zoneAt, zoneDecayMultiplier } from './zones.js';

const balance = DEFAULT_BALANCE;
const { ecology, world } = balance;
const gelPatch: GelPatchView = { x: 1500, y: 0, radius: ecology.GEL_PATCH_RADIUS };

describe('shallowsInnerRadius', () => {
  it('is the dish radius less the shallows width', () => {
    expect(shallowsInnerRadius(balance)).toBe(world.DISH_RADIUS - ecology.SHALLOWS_WIDTH);
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
