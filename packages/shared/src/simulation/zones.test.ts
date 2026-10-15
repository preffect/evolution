// docs/ecology/food-and-spawn.md §2: zone precedence; docs/ecology/mass-and-movement.md §4: the zone's decay;
// docs/game-design/phases.md §14.5.2: from the pool's move the light patch is the one sunlit zone, and the dish's vent and
// gel are gone.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { createTestPoolLayout } from '../testing/builders.js';
import { secondsToTicks } from '../time/units.js';
import { GAME_ERA, ZONE_ID, type GelPatchView } from '../types/game.js';
import { lightPatchCentreAt } from './pool-layout.js';
import {
  dishZoneMap,
  isInsideGelPatch,
  shallowsInnerRadius,
  zoneAt,
  zoneDecayMultiplier,
  zoneMapAt,
  type ZoneMapSource,
} from './zones.js';

const balance = DEFAULT_BALANCE;
const { ecology, world } = balance;
const gelPatch: GelPatchView = { x: 1500, y: 0, radius: ecology.GEL_PATCH_RADIUS };
const dish = dishZoneMap([gelPatch]);
/** The test layout's orbit: 1 500 wu due east on tick 0, a quarter turn later due north. */
const layout = createTestPoolLayout();
const QUARTER_PERIOD_TICKS = secondsToTicks(balance.pool.POOL_LIGHT_PATCH_PERIOD_SECONDS) / 4;
const inThePool: ZoneMapSource = { era: GAME_ERA.pool, gelPatches: [gelPatch], poolLayout: layout };

describe('shallowsInnerRadius', () => {
  it('is the dish radius less the shallows width', () => {
    expect(shallowsInnerRadius(balance)).toBe(world.DISH_RADIUS - ecology.SHALLOWS_WIDTH);
  });
});

describe('zoneAt', () => {
  it('resolves shallows, then vent, then gel, then broth', () => {
    expect(zoneAt({ x: 2750, y: 0 }, dish, balance)).toBe(ZONE_ID.sunlitShallows);
    expect(zoneAt({ x: 2500, y: 0 }, dish, balance)).toBe(ZONE_ID.sunlitShallows);
    expect(zoneAt({ x: 0, y: 0 }, dish, balance)).toBe(ZONE_ID.warmVent);
    expect(zoneAt({ x: 0, y: 500 }, dish, balance)).toBe(ZONE_ID.warmVent);
    expect(zoneAt({ x: 1500, y: 100 }, dish, balance)).toBe(ZONE_ID.viscousGel);
    expect(zoneAt({ x: 1500, y: 0 }, dishZoneMap([]), balance)).toBe(ZONE_ID.openBroth);
    expect(zoneAt({ x: 1500, y: 351 }, dish, balance)).toBe(ZONE_ID.openBroth);
  });

  it('isInsideGelPatch is inclusive at the rim', () => {
    expect(isInsideGelPatch({ x: 1500 + ecology.GEL_PATCH_RADIUS, y: 0 }, [gelPatch])).toBe(true);
    expect(isInsideGelPatch({ x: 1500 + ecology.GEL_PATCH_RADIUS + 0.01, y: 0 }, [gelPatch])).toBe(false);
  });
});

describe('zoneMapAt', () => {
  it('is the dish’s map in the dish, a layout or none: the warning carries the layout before the move', () => {
    expect(zoneMapAt({ ...inThePool, era: GAME_ERA.dish }, 0, balance)).toEqual(dish);
    expect(zoneMapAt({ ...inThePool, poolLayout: null }, 0, balance)).toEqual(dish);
  });

  it('puts the light patch where the orbit has it on the tick, in the pool and in every era after it', () => {
    for (const era of [GAME_ERA.pool, GAME_ERA.colonies]) {
      const map = zoneMapAt({ ...inThePool, era }, QUARTER_PERIOD_TICKS, balance);
      expect(map.lightPatchCentre).toEqual(lightPatchCentreAt(layout.lightPatchOrbit, QUARTER_PERIOD_TICKS, balance));
    }
  });
});

describe('zoneAt in the pool', () => {
  const patchRadius = balance.pool.POOL_LIGHT_PATCH_RADIUS;
  const onTickZero = zoneMapAt(inThePool, 0, balance);

  it('is sunlit inside the light patch, its rim included, and open water past it', () => {
    expect(zoneAt({ x: 1500 + patchRadius, y: 0 }, onTickZero, balance)).toBe(ZONE_ID.sunlitShallows);
    expect(zoneAt({ x: 1500 + patchRadius + 0.01, y: 0 }, onTickZero, balance)).toBe(ZONE_ID.openBroth);
  });

  it('follows the patch round its orbit: a point it lit on tick 0 is open water a quarter turn later', () => {
    const later = zoneMapAt(inThePool, QUARTER_PERIOD_TICKS, balance);
    expect(zoneAt({ x: 1500, y: 0 }, later, balance)).toBe(ZONE_ID.openBroth);
    expect(zoneAt({ x: 0, y: 1500 }, later, balance)).toBe(ZONE_ID.sunlitShallows);
    expect(zoneAt({ x: 0, y: 1500 }, onTickZero, balance)).toBe(ZONE_ID.openBroth);
  });

  it('has no vent, no gel and no shallows annulus: the dish’s zones do not follow the players', () => {
    expect(zoneAt({ x: 0, y: 0 }, onTickZero, balance)).toBe(ZONE_ID.openBroth);
    expect(zoneAt(gelPatch, onTickZero, balance)).toBe(ZONE_ID.sunlitShallows);
    expect(zoneAt({ x: 1500, y: 100 }, zoneMapAt(inThePool, QUARTER_PERIOD_TICKS, balance), balance)).toBe(
      ZONE_ID.openBroth,
    );
    expect(zoneAt({ x: -2750, y: 0 }, onTickZero, balance)).toBe(ZONE_ID.openBroth);
  });

  it('reads the live patch radius', () => {
    const wider = structuredClone(balance);
    wider.pool.POOL_LIGHT_PATCH_RADIUS *= 2;
    expect(zoneAt({ x: 1500 + patchRadius + 1, y: 0 }, zoneMapAt(inThePool, 0, wider), wider)).toBe(
      ZONE_ID.sunlitShallows,
    );
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
