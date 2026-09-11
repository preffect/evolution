import { describe, expect, it } from 'vitest';
import { FLAGELLUM_LENGTH_RADII, FLAGELLUM_SEGMENTS } from '../constants';
import { flagellumPolyline, flagellumTailCount, type FlagellumSpec } from './flagellum-lines';

const spec: FlagellumSpec = {
  x: 100,
  y: 50,
  radius: 20,
  heading: 0,
  tier: 1,
  timeSeconds: 0,
  isSprinting: false,
  phase: 0,
};

const span = (points: { x: number; y: number }[]) => Math.max(...points.map((point) => Math.abs(point.y - 50)));

describe('flagellumPolyline', () => {
  it('roots the tail on the membrane behind the heading and reaches 2 r behind it', () => {
    const points = flagellumPolyline(spec, 0);
    expect(points).toHaveLength(FLAGELLUM_SEGMENTS + 1);
    expect(points[0]).toEqual({ x: 100 - 20, y: 50 });
    expect(points.at(-1)!.x).toBeCloseTo(100 - 20 - FLAGELLUM_LENGTH_RADII * 20, 6);
  });

  it('waves wider per tier and doubles on sprint', () => {
    const tierOne = span(flagellumPolyline({ ...spec, timeSeconds: 0.1 }, 0));
    const tierTwo = span(flagellumPolyline({ ...spec, timeSeconds: 0.1, tier: 2 }, 0));
    const sprinting = span(flagellumPolyline({ ...spec, timeSeconds: 0.1, isSprinting: true }, 0));
    expect(tierTwo).toBeGreaterThan(tierOne);
    expect(sprinting).toBeCloseTo(tierOne * 2, 6);
  });

  it('grows a second tail at tier III, spread to either side', () => {
    expect(flagellumTailCount(1)).toBe(1);
    expect(flagellumTailCount(3)).toBe(2);
    const left = flagellumPolyline({ ...spec, tier: 3 }, 0).at(-1)!;
    const right = flagellumPolyline({ ...spec, tier: 3 }, 1).at(-1)!;
    expect(Math.sign(left.y - 50)).toBe(-Math.sign(right.y - 50));
  });

  it('travels: the wave moves along the tail over time', () => {
    const before = flagellumPolyline({ ...spec, timeSeconds: 0 }, 0)[4]!;
    const after = flagellumPolyline({ ...spec, timeSeconds: 0.05 }, 0)[4]!;
    expect(after.y).not.toBeCloseTo(before.y, 6);
  });
});
