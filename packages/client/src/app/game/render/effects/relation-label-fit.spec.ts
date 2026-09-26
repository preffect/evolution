// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { LABEL_PILL_HEIGHT_PX, THREAT_LABEL_GAP_PX } from '../constants';
import { HALF, boxIntersectsDisc, boxesIntersect } from '../geometry';
import { ladderOrbitExtentPx } from './own-cell-geometry';
import {
  NEIGHBOUR_CLEARANCE_PX,
  pillOnSide,
  relationLabelFit,
  relationLabelSides,
  type RelationLabelFitInput,
} from './relation-label-fit';

const OWN = { x: 0, y: 0 };
const OWN_RADIUS_PX = 20;
const PILL_WIDTH_PX = 170;
const RING_PX = 30;
/** Far enough right that the pill facing the own cell clears the orbit extent. */
const CELL = { x: 400, y: 0 };

function input(overrides: Partial<RelationLabelFitInput> = {}): RelationLabelFitInput {
  return {
    cellCentre: CELL,
    ringPx: RING_PX,
    ownCentre: OWN,
    ownRadiusPx: OWN_RADIUS_PX,
    pillWidthPx: PILL_WIDTH_PX,
    rings: [],
    placed: [],
    ...overrides,
  };
}

describe('relationLabelFit', () => {
  it('with nothing near, takes the side facing the own cell, its near edge one gap off the ring', () => {
    const box = relationLabelFit(input())!;
    expect(box.y).toBe(0);
    expect(box.x + box.halfWidth).toBe(CELL.x - RING_PX - THREAT_LABEL_GAP_PX);
    expect(box.halfHeight).toBe(LABEL_PILL_HEIGHT_PX * HALF);
  });

  it('moves off a neighbour ring on the facing side, and the pill it takes meets no ring', () => {
    const facing = pillOnSide(input(), relationLabelSides(CELL, OWN)[0]!);
    const neighbour = { x: facing.x, y: facing.y + 10, radius: 26 };
    expect(boxIntersectsDisc(facing, neighbour)).toBe(true);

    const box = relationLabelFit(input({ rings: [neighbour] }))!;
    expect(boxIntersectsDisc(box, { ...neighbour, radius: neighbour.radius + NEIGHBOUR_CLEARANCE_PX })).toBe(false);
    expect(box.x).toBe(CELL.x);
    expect(box.y + box.halfHeight).toBe(-(RING_PX + THREAT_LABEL_GAP_PX));
  });

  it('keeps clear of a label already placed, so two pills never overlap', () => {
    const facing = pillOnSide(input(), relationLabelSides(CELL, OWN)[0]!);
    const box = relationLabelFit(input({ placed: [facing] }))!;
    expect(boxesIntersect(box, facing)).toBe(false);
  });

  it('never crosses the own cell’s orbit extent: a cell close by labels on its far side', () => {
    const near = { x: 90, y: 0 };
    const box = relationLabelFit(input({ cellCentre: near }))!;
    const orbit = { ...OWN, radius: ladderOrbitExtentPx(OWN_RADIUS_PX) };
    expect(boxIntersectsDisc(box, orbit)).toBe(false);
    expect(box.x).toBeGreaterThan(near.x);
  });

  it('drops the label when every side is blocked, rather than put it over another cell', () => {
    const rings = relationLabelSides(CELL, OWN).map((side) => {
      const box = pillOnSide(input(), side);
      return { x: box.x, y: box.y, radius: 10 };
    });
    expect(relationLabelFit(input({ rings }))).toBeNull();
  });

  it('tries the axis sides most-facing the own cell first: beside, then above and below, then the far side', () => {
    expect(relationLabelSides(CELL, OWN)).toEqual([
      { x: -1, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: 1, y: 0 },
    ]);
    expect(relationLabelSides({ x: 30, y: -300 }, OWN)[0]).toEqual({ x: 0, y: 1 });
  });

  it('keeps NEIGHBOUR_CLEARANCE_PX from another ring, so a pill barely off a neighbour still moves', () => {
    const facing = pillOnSide(input(), relationLabelSides(CELL, OWN)[0]!);
    const grazing = { x: facing.x, y: facing.y + facing.halfHeight + 20 + NEIGHBOUR_CLEARANCE_PX * HALF, radius: 20 };
    expect(boxIntersectsDisc(facing, grazing)).toBe(false);
    expect(relationLabelFit(input({ rings: [grazing] }))).not.toEqual(facing);
  });
});
