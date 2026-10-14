// @vitest-environment node
// The coast in metres (docs/rendering/opening-dive.md §4): the Salish rings projected round the focus, refined below
// the data's resolution without moving the focus off the waterline, warped at the rocky point, cut to the view, and
// measured: + on land, − at sea.

import { describe, expect, it } from 'vitest';
import { DIVE_FOCUS_DEGREES, EARTH_RADIUS_M } from '../../constants/dive';
import { ShoreCoast, segmentAt } from './shore-coast';
import { clipToEdge, refineSegment, warpRockyPoint, type CoastWindow } from './shore-coast-refine';
import { landRingsOf, projectToFocus, type GeoRing } from './shore-coast-rings';
import { pointCount, pointX, pointY } from './shore-points';

const { longitude, latitude } = DIVE_FOCUS_DEGREES;
const DEGREE_M = (EARTH_RADIUS_M * Math.PI) / 180;

/** Land north of the focus: a square whose south edge runs east–west through the focus (a vertex of it). */
const NORTH_LAND: GeoRing = [
  [longitude, latitude],
  [longitude + 0.05, latitude],
  [longitude + 0.05, latitude + 0.05],
  [longitude - 0.05, latitude + 0.05],
  [longitude - 0.05, latitude],
  [longitude, latitude],
];

/** A far frame of land that sets the data's box, so the square near the focus is coast and not the box. */
const FRAME: GeoRing = [
  [longitude - 1, latitude - 1],
  [longitude + 1, latitude - 1],
  [longitude + 1, latitude + 1],
  [longitude - 1, latitude + 1],
  [longitude - 1, latitude - 1],
];
const RINGS = [NORTH_LAND, FRAME];

describe('projectToFocus', () => {
  it('puts the focus at the origin, east at +x and north at −y, a degree of latitude ~111 km', () => {
    expect(projectToFocus(longitude, latitude)).toEqual([0, 0]);
    const [eastX] = projectToFocus(longitude + 0.01, latitude);
    expect(eastX).toBeGreaterThan(0);
    const [, northY] = projectToFocus(longitude, latitude + 1);
    expect(northY).toBeLessThan(0);
    expect(Math.abs(Math.abs(northY) - DEGREE_M)).toBeLessThan(500);
  });
});

describe('landRingsOf', () => {
  it('drops the closing point, measures the box, and calibrates which side is land on the ring through the focus', () => {
    const { rings, landSide } = landRingsOf(RINGS);
    expect(rings).toHaveLength(2);
    expect(rings[0]!.count).toBe(NORTH_LAND.length - 1);
    expect(rings[0]!.maxY).toBe(0);
    // a point just north of the focus must read as land
    const coast = new ShoreCoast({ rings, landSide });
    coast.build({ halfWidthM: 200, halfHeightM: 120, pixelsPerMetre: 2 });
    expect(coast.distance(0, -30, 100)).toBeGreaterThan(0);
    expect(coast.distance(0, 30, 100)).toBeLessThan(0);
  });

  it('marks the edges where the data was cut to its box: they are not coast', () => {
    const { rings } = landRingsOf(RINGS);
    expect([...rings[0]!.isBoxEdge].every((edge) => edge === 0)).toBe(true);
    expect([...rings[1]!.isBoxEdge].every((edge) => edge === 1)).toBe(true);
  });
});

describe('refineSegment', () => {
  const window: CoastWindow = {
    minX: -100,
    minY: -60,
    maxX: 100,
    maxY: 60,
    marginM: 150,
    halfWidthM: 100,
    pixelsPerMetre: 4,
  };

  it('splits a long segment until its pieces are a few px on screen, the same way every time', () => {
    const first: number[] = [];
    const second: number[] = [];
    const segment = {
      startX: -90,
      startY: 10,
      endX: 90,
      endY: 10,
      hash: 12345,
      depth: 0,
      isFocusStart: false,
      isFocusEnd: false,
    };
    refineSegment(window, segment, first);
    refineSegment(window, segment, second);
    expect(first).toEqual(second);
    expect(pointCount(first)).toBeGreaterThan(40);
    expect([pointX(first, pointCount(first) - 1), pointY(first, pointCount(first) - 1)]).toEqual([90, 10]);
  });

  it('runs east–west next to the focus below 600 m, keeping the focus on the waterline', () => {
    const out: number[] = [];
    refineSegment(
      window,
      { startX: 0, startY: 0, endX: 80, endY: 40, hash: 99, depth: 0, isFocusStart: true, isFocusEnd: false },
      out,
    );
    const firstMid = { x: pointX(out, 0), y: pointY(out, 0) };
    expect(Math.abs(firstMid.y)).toBeLessThan(Math.abs(firstMid.x));
  });
});

describe('warpRockyPoint', () => {
  it('pushes the waterline 0.6 m seaward at the focus and leaves the far coast alone', () => {
    expect(warpRockyPoint(0, 0)).toBeCloseTo(0.6, 9);
    expect(warpRockyPoint(20000, 300)).toBe(300);
  });

  it('draws the shore either side of the focus back toward land', () => {
    expect(warpRockyPoint(600, 0)).toBeLessThan(0);
  });
});

describe('clipToEdge', () => {
  it('cuts a square to one side of an edge, adding the crossings', () => {
    const square = [-1, -1, 1, -1, 1, 1, -1, 1];
    const cut = clipToEdge(square, { axis: 0, value: 0, isKeepingBelow: true });
    const crossingsX = Array.from({ length: pointCount(cut) }, (_unused, index) => pointX(cut, index));
    expect(Math.max(...crossingsX)).toBe(0);
    expect(pointCount(cut)).toBe(4);
  });
});

describe('ShoreCoast', () => {
  const coast = new ShoreCoast(landRingsOf(RINGS));
  coast.build({ halfWidthM: 300, halfHeightM: 170, pixelsPerMetre: 1.4 });

  it('keeps the segments near the window, each with its land sign', () => {
    expect(coast.segments.length).toBeGreaterThan(0);
    const first = segmentAt(coast.segments, 0);
    expect(Math.abs(first.landSign)).toBe(1);
  });

  it('answers NaN when no coast lies within the reach asked', () => {
    expect(Number.isNaN(coast.distance(0, -2000, 10))).toBe(true);
  });

  it('cuts its rings to the window and its margin', () => {
    for (const ring of coast.rings) {
      for (let index = 0; index < pointCount(ring.points); index += 1) {
        expect(Math.abs(pointX(ring.points, index))).toBeLessThanOrEqual(300 + coast.marginM + 1e-6);
      }
    }
  });
});
