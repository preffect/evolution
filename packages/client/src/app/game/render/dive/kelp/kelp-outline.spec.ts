// @vitest-environment node
// Outlines baked into signed distances (docs/rendering/opening-dive.md §4): the shore's `rockPath` sampled into a
// polygon, its winding, the nonzero winding number, and a polygon's distance bake read back as the shader reads it:
// + inside, − outside, zero on the outline, in metres.

import { describe, expect, it } from 'vitest';
import { decodeSignedDistance } from '../planet/signed-distance';
import { focalRockPlace } from './kelp-bakes';
import { bakeOutlineDistance, boxRound, boxUniform, rockOutline, signedArea, windingAt } from './kelp-outline';

/** A 2 m square round the origin, wound clockwise on screen (y down). */
const SQUARE = [-1, -1, 1, -1, 1, 1, -1, 1];

function runToEnd<T>(steps: Generator<void, T>): { value: T; yields: number } {
  let yields = 0;
  for (;;) {
    const step = steps.next();
    if (step.done === true) return { value: step.value, yields };
    yields += 1;
  }
}

describe('rockOutline', () => {
  it('samples each of the stone’s 24 curves `perCurve` times, all round its centre', () => {
    const place = focalRockPlace();
    const outline = rockOutline(place, 4);
    // the first point, then four samples of each curve back round to it
    expect(outline.length / 2).toBe(1 + 24 * 4);
    for (let index = 0; index < outline.length; index += 2) {
      const reach = Math.hypot(outline[index]! - place.x, (outline[index + 1]! - place.y) / place.squash);
      expect(reach).toBeGreaterThan(place.radius * 0.75);
      expect(reach).toBeLessThan(place.radius * 1.2);
    }
  });
});

describe('signedArea and windingAt', () => {
  it('tells a clockwise polygon from a counter-clockwise one, and its winding inside from outside', () => {
    const reversed = [-1, 1, 1, 1, 1, -1, -1, -1];
    expect(signedArea(SQUARE)).toBe(8);
    expect(signedArea(reversed)).toBe(-8);
    expect(windingAt([SQUARE], 0, 0)).toBe(-windingAt([reversed], 0, 0));
    expect(Math.abs(windingAt([SQUARE], 0, 0))).toBe(1);
    expect(windingAt([SQUARE], 3, 0)).toBe(0);
    expect(windingAt([SQUARE, SQUARE], 0, 0)).toBe(2 * windingAt([SQUARE], 0, 0));
  });
});

describe('bakeOutlineDistance', () => {
  it('bakes + inside and − outside, zero on the outline, in metres, a few rows a step', () => {
    const box = boxRound({ x: 0, y: 0, radius: 1 }, 2);
    const { value: bake, yields } = runToEnd(bakeOutlineDistance([SQUARE], box, 0.05));
    expect([bake.width, bake.height]).toEqual([80, 80]);
    expect(yields).toBeGreaterThan(0);
    const metresAt = (x: number, y: number): number => {
      const column = Math.floor((x - box[0]) / bake.metresPerTexel);
      const row = Math.floor((y - box[1]) / bake.metresPerTexel);
      return decodeSignedDistance(bake.data, row * bake.width + column) * bake.metresPerTexel;
    };
    expect(metresAt(0.01, 0.01)).toBeCloseTo(0.975, 1);
    expect(metresAt(1.51, 0.01)).toBeCloseTo(-0.525, 1);
    expect(Math.abs(metresAt(0.99, 0.01))).toBeLessThan(0.05);
    expect(boxUniform(bake)).toEqual([-2, -2, 4, 4]);
  });
});
