import { describe, expect, it } from 'vitest';
import { ScenarioSetupError } from './errors.js';
import {
  createDecayedHelper,
  FIRST_TRAIT_TIER,
  GEL_PATCH_CLEARANCE_WU,
  isClearOfGelPatches,
  PLACED_KIND,
  placeCell,
  placeFragment,
  placeMote,
  resolvePlacement,
  toPlacedTrait,
} from './fixtures.js';
import { atPoint, BROTH_POINT, eastOfCellOf, VENT_POINT, ZONE } from './placement.js';

// ECOLOGY §7 values, passed in because the constants land with #98.
const ECOLOGY = { cellStartingMass: 20, massDecayRatePerSecond: 0.002 };
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

describe('isClearOfGelPatches', () => {
  it('rejects a patch inside the clearance and accepts one on it', () => {
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

  it('puts the first cell at the broth point, unpinned, without traits or fixture DNA', () => {
    expect(first).toEqual({
      kind: PLACED_KIND.cell,
      playerIndex: 0,
      mass: 100,
      at: ZONE.broth,
      isPinned: false,
      traits: [],
      dnaCumulative: null,
    });
  });

  it('puts a second cell east of the first cell, resolved by the adapter against that cell', () => {
    const second = placeCell({ playerIndex: 1, mass: 20, eastOfFirstCellWu: 10 }, first);
    expect(second.at).toEqual(eastOfCellOf(0, 10));
  });

  it('requires a placement for anything after the first cell', () => {
    expect(() => placeCell({ playerIndex: 1, mass: 20 }, first)).toThrow(ScenarioSetupError);
    expect(() => placeCell({ playerIndex: 1, mass: 20 }, first)).toThrow(/needs a placement/);
  });

  it('cannot place east of a cell that does not exist yet', () => {
    expect(() => resolvePlacement({ eastOfFirstCellWu: 10 }, undefined, 'the mote')).toThrow(/no cell has been placed/);
  });

  it('honours a point, a zone, pinning, tiered traits and fixture DNA', () => {
    const pinned = placeCell(
      { playerIndex: 0, mass: 20, at: VENT_POINT, isPinned: true, traits: ['cilia', { traitId: 'nucleoid', tier: 2 }] },
      first,
    );
    expect(pinned.at).toEqual(atPoint(VENT_POINT.x, VENT_POINT.y));
    expect(pinned.isPinned).toBe(true);
    expect(pinned.traits).toEqual([
      { traitId: 'cilia', tier: FIRST_TRAIT_TIER },
      { traitId: 'nucleoid', tier: 2 },
    ]);
    const levelled = placeCell({ playerIndex: 0, mass: 20, at: ZONE.vent, dnaCumulative: 1760 }, first);
    expect(levelled.at).toBe(ZONE.vent);
    expect(levelled.dnaCumulative).toBe(1760);
  });

  it('rejects a trait tier outside I to III', () => {
    expect(() => toPlacedTrait({ traitId: 'cilia', tier: 4 })).toThrow(ScenarioSetupError);
    expect(() => toPlacedTrait({ traitId: 'cilia', tier: 0 })).toThrow(/tiers 1 to 3/);
    expect(toPlacedTrait({ traitId: 'cilia' })).toEqual({ traitId: 'cilia', tier: FIRST_TRAIT_TIER });
  });

  it('places motes and fragments relative to the first cell (E4: algae 10 wu east)', () => {
    expect(placeMote({ moteKind: 'algae', eastOfFirstCellWu: 10 }, first)).toEqual({
      kind: PLACED_KIND.mote,
      moteKind: 'algae',
      variant: null,
      at: eastOfCellOf(0, 10),
    });
    expect(placeMote({ moteKind: 'bacterium', variant: 'aerobic', eastOfFirstCellWu: 0 }, first).variant).toBe(
      'aerobic',
    );
    expect(placeFragment({ tag: 'sensory', eastOfFirstCellWu: 0 }, first)).toEqual({
      kind: PLACED_KIND.fragment,
      tag: 'sensory',
      at: eastOfCellOf(0, 0),
    });
  });

  it('places a lone mote at the broth point when no cell was placed', () => {
    expect(placeMote({ moteKind: 'algae' }, undefined).at).toBe(ZONE.broth);
  });
});
