import { describe, expect, it } from 'vitest';
import { boxCorners, orientedBoxGapPx, type OrientedBox } from './oriented-box';

const QUARTER_TURN = Math.PI / 2;
const EIGHTH_TURN = Math.PI / 4;

/** A 4 × 2 box at the origin, lying along +x, unless told otherwise. */
function box(overrides: Partial<OrientedBox> = {}): OrientedBox {
  return { x: 0, y: 0, rotation: 0, halfLength: 2, halfHeight: 1, ...overrides };
}

describe('boxCorners', () => {
  it('turns the long axis with the rotation: a quarter turn stands the box on end', () => {
    const corners = boxCorners(box({ rotation: QUARTER_TURN }));
    expect(Math.max(...corners.map((corner) => corner.x))).toBeCloseTo(1);
    expect(Math.max(...corners.map((corner) => corner.y))).toBeCloseTo(2);
  });
});

describe('orientedBoxGapPx', () => {
  it('is the space between two upright boxes side by side', () => {
    // Edges at x = 2 and x = 5.
    expect(orientedBoxGapPx(box(), box({ x: 7 }))).toBeCloseTo(3);
  });

  it('measures from a turned box’s corner, which reaches further than its centre line does', () => {
    // A 2 × 2 square turned an eighth of a turn points a corner √2 out, toward a wall whose face is at x = 3.
    const diamond = box({ halfLength: 1, halfHeight: 1, rotation: EIGHTH_TURN });
    const wall = box({ x: 4, halfLength: 1, halfHeight: 5 });
    expect(orientedBoxGapPx(diamond, wall)).toBeCloseTo(3 - Math.SQRT2);
  });

  it('is zero when the boxes touch or overlap, never negative', () => {
    expect(orientedBoxGapPx(box(), box({ x: 4 }))).toBe(0);
    expect(orientedBoxGapPx(box(), box({ x: 1, rotation: EIGHTH_TURN }))).toBe(0);
  });

  it('reads the same from either box', () => {
    const first = box({ rotation: 0.3 });
    const second = box({ x: 5, y: 3, rotation: -1.1 });
    expect(orientedBoxGapPx(first, second)).toBeCloseTo(orientedBoxGapPx(second, first));
  });
});
