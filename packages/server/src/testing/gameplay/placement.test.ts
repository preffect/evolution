import { describe, expect, it } from 'vitest';
import {
  ANCHOR_KIND,
  atPoint,
  BROTH_POINT,
  describeAnchor,
  eastOfCellOf,
  gelPatchCentre,
  insideCellOf,
  resolveFixedAnchor,
  shallowsPoint,
  toAnchor,
  VENT_POINT,
  ZONE,
} from './placement.js';

// ECOLOGY §2 values, passed in because the constants land with #98.
const DISH = { dishRadiusWu: 3000, shallowsWidthWu: 500 };

describe('placement points', () => {
  it('states the convention: broth (1500, 0), vent at the origin, shallows at (2750, 0)', () => {
    expect(BROTH_POINT).toEqual({ x: 1500, y: 0 });
    expect(VENT_POINT).toEqual({ x: 0, y: 0 });
    expect(shallowsPoint(DISH.dishRadiusWu, DISH.shallowsWidthWu)).toEqual({ x: 2750, y: 0 });
  });
});

describe('anchors', () => {
  it('builds the relative forms the adapter resolves against its world', () => {
    expect(insideCellOf(1)).toEqual({ kind: ANCHOR_KIND.insideCellOf, playerIndex: 1 });
    expect(eastOfCellOf(0, 10)).toEqual({ kind: ANCHOR_KIND.eastOfCellOf, playerIndex: 0, distanceWu: 10 });
    expect(gelPatchCentre(2)).toEqual({ kind: ANCHOR_KIND.gelPatchCentre, patchIndex: 2 });
    expect(atPoint(1, 2)).toEqual({ kind: ANCHOR_KIND.point, at: { x: 1, y: 2 } });
  });

  it('turns a bare point into a point anchor and leaves an anchor alone', () => {
    expect(toAnchor({ x: 1, y: 2 })).toEqual(atPoint(1, 2));
    expect(toAnchor(ZONE.vent)).toBe(ZONE.vent);
  });

  it('resolves points and named zones without a world, and nothing else', () => {
    expect(resolveFixedAnchor(atPoint(1, 2), DISH)).toEqual({ x: 1, y: 2 });
    expect(resolveFixedAnchor(ZONE.broth, DISH)).toEqual(BROTH_POINT);
    expect(resolveFixedAnchor(ZONE.vent, DISH)).toEqual(VENT_POINT);
    expect(resolveFixedAnchor(ZONE.shallows, DISH)).toEqual({ x: 2750, y: 0 });
    expect(resolveFixedAnchor(insideCellOf(0), DISH)).toBeNull();
    expect(resolveFixedAnchor(eastOfCellOf(0, 10), DISH)).toBeNull();
    expect(resolveFixedAnchor(gelPatchCentre(0), DISH)).toBeNull();
  });

  it('describes every anchor for a setup error', () => {
    expect(describeAnchor(atPoint(1, 2))).toBe('(1, 2)');
    expect(describeAnchor(ZONE.shallows)).toBe('the shallows');
    expect(describeAnchor(gelPatchCentre(1))).toBe('the centre of gel patch 1');
    expect(describeAnchor(insideCellOf(0))).toBe("inside player 0's cell");
    expect(describeAnchor(eastOfCellOf(1, 10))).toBe("10 wu east of player 1's cell");
  });
});
