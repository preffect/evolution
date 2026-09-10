import { describe, expect, it } from 'vitest';
import { ScenarioSetupError } from './errors.js';
import {
  BROTH_POINT,
  createDecayedHelper,
  GEL_PATCH_CLEARANCE_WU,
  isClearOfGelPatches,
  PLACED_KIND,
  placeCell,
  placeFragment,
  placeMote,
  resolvePlacement,
  shallowsPoint,
  VENT_POINT,
} from './fixtures.js';

// ECOLOGY §7 values, passed in because the constants land with #98.
const ECOLOGY = { cellStartingMass: 20, massDecayRatePerSecond: 0.002 };
const DISH_RADIUS = 3000;
const SHALLOWS_WIDTH = 500;
const MASS_TOLERANCE = 0.01;

describe('decayed', () => {
  const decayed = createDecayedHelper(ECOLOGY);

  it('reproduces ECOLOGY E5: 1020 for 60 ticks in the broth is ≈ 1018.00', () => {
    expect(Math.abs(decayed(1020, 60) - 1018)).toBeLessThan(MASS_TOLERANCE);
  });

  it('applies the zone multiplier (E5 in the vent, k = 1.5, ≈ 1017.00)', () => {
    expect(Math.abs(decayed(1020, 60, 1.5) - 1017)).toBeLessThan(MASS_TOLERANCE);
  });

  it('never moves the starting mass and leaves tick 0 untouched', () => {
    expect(decayed(ECOLOGY.cellStartingMass, 600)).toBe(ECOLOGY.cellStartingMass);
    expect(decayed(100, 0)).toBe(100);
  });
});

describe('placement points', () => {
  it('states the convention: broth (1500, 0), vent at the origin, shallows at (2750, 0)', () => {
    expect(BROTH_POINT).toEqual({ x: 1500, y: 0 });
    expect(VENT_POINT).toEqual({ x: 0, y: 0 });
    expect(shallowsPoint(DISH_RADIUS, SHALLOWS_WIDTH)).toEqual({ x: 2750, y: 0 });
  });

  it('isClearOfGelPatches rejects a patch inside the clearance and accepts one on it', () => {
    expect(
      isClearOfGelPatches(BROTH_POINT, [{ x: 1500 + GEL_PATCH_CLEARANCE_WU - 1, y: 0 }], GEL_PATCH_CLEARANCE_WU),
    ).toBe(false);
    expect(isClearOfGelPatches(BROTH_POINT, [{ x: 1500, y: GEL_PATCH_CLEARANCE_WU }], GEL_PATCH_CLEARANCE_WU)).toBe(
      true,
    );
    expect(isClearOfGelPatches(BROTH_POINT, [], GEL_PATCH_CLEARANCE_WU)).toBe(true);
  });
});

describe('placed fixtures', () => {
  const first = placeCell({ playerIndex: 0, mass: 100 }, undefined);

  it('puts the first cell at the broth point, unpinned, without traits', () => {
    expect(first).toEqual({
      kind: PLACED_KIND.cell,
      playerIndex: 0,
      mass: 100,
      at: BROTH_POINT,
      isPinned: false,
      traitIds: [],
    });
  });

  it('puts a second cell east of the first on the x axis at the centre distance', () => {
    const second = placeCell({ playerIndex: 1, mass: 20, eastOfFirstCellWu: 10 }, first);
    expect(second.at).toEqual({ x: 1510, y: 0 });
  });

  it('requires a placement for anything after the first cell', () => {
    expect(() => placeCell({ playerIndex: 1, mass: 20 }, first)).toThrow(ScenarioSetupError);
    expect(() => placeCell({ playerIndex: 1, mass: 20 }, first)).toThrow(/needs a placement/);
  });

  it('cannot place east of a cell that does not exist yet', () => {
    expect(() => resolvePlacement({ eastOfFirstCellWu: 10 }, undefined, 'the mote')).toThrow(/no cell has been placed/);
  });

  it('honours an explicit point, pinning and fixture-granted traits', () => {
    const pinned = placeCell({ playerIndex: 0, mass: 20, at: VENT_POINT, isPinned: true, traitIds: ['cilia'] }, first);
    expect(pinned.at).toEqual(VENT_POINT);
    expect(pinned.isPinned).toBe(true);
    expect(pinned.traitIds).toEqual(['cilia']);
  });

  it('places motes and fragments relative to the first cell (E4: algae 10 wu east)', () => {
    expect(placeMote({ moteKind: 'algae', eastOfFirstCellWu: 10 }, first)).toEqual({
      kind: PLACED_KIND.mote,
      moteKind: 'algae',
      variant: null,
      at: { x: 1510, y: 0 },
    });
    expect(placeMote({ moteKind: 'bacterium', variant: 'aerobic', eastOfFirstCellWu: 0 }, first).variant).toBe(
      'aerobic',
    );
    expect(placeFragment({ tag: 'sensory', eastOfFirstCellWu: 0 }, first)).toEqual({
      kind: PLACED_KIND.fragment,
      tag: 'sensory',
      at: BROTH_POINT,
    });
  });

  it('places a lone mote at the broth point when no cell was placed', () => {
    expect(placeMote({ moteKind: 'algae' }, undefined).at).toEqual(BROTH_POINT);
  });
});
