// docs/VISUAL-STYLE.md §4 `simple_flagellum`: 2 r long, two waves opposite velocity, amplitude per tier, two tails at III.

import { describe, expect, it, vi } from 'vitest';
import { FLAGELLUM_LENGTH_RADII, FLAGELLUM_SEGMENTS } from '../constants';
import {
  FlagellumLines,
  createTailPoints,
  flagellumPolyline,
  flagellumTailCount,
  type FlagellumSpec,
} from './flagellum-lines';

const spec: FlagellumSpec = {
  x: 100,
  y: 50,
  radius: 20,
  rootRadius: 20,
  heading: 0,
  tier: 1,
  timeSeconds: 0,
  isSprinting: false,
  phase: 0,
};

const span = (points: readonly { y: number }[]) => Math.max(...points.map((point) => Math.abs(point.y - 50)));

describe('flagellumPolyline', () => {
  it('roots the tail on the deformed rear membrane behind the heading and reaches 2 r past it', () => {
    const points = flagellumPolyline(spec, 0);
    expect(points).toHaveLength(FLAGELLUM_SEGMENTS + 1);
    expect(points[0]!.x).toBeCloseTo(100 - 20, 9);
    expect(points[0]!.y).toBeCloseTo(50, 9);
    expect(points.at(-1)!.x).toBeCloseTo(100 - 20 - FLAGELLUM_LENGTH_RADII * 20, 6);
    const tapered = flagellumPolyline({ ...spec, rootRadius: 14.4 }, 0);
    expect(tapered[0]!.x).toBeCloseTo(100 - 14.4, 9);
    expect(tapered.at(-1)!.x).toBeCloseTo(100 - 14.4 - FLAGELLUM_LENGTH_RADII * 20, 6);
  });

  it('writes into the array it is given, so a pooled tail allocates nothing per frame', () => {
    const into = createTailPoints();
    const first = into[3];
    expect(flagellumPolyline(spec, 0, into)).toBe(into);
    expect(into[3]).toBe(first);
  });

  it('waves wider per tier and doubles on sprint', () => {
    const tierOne = span(flagellumPolyline({ ...spec, timeSeconds: 0.1 }, 0));
    const tierTwo = span(flagellumPolyline({ ...spec, timeSeconds: 0.1, tier: 2 }, 0));
    const sprinting = span(flagellumPolyline({ ...spec, timeSeconds: 0.1, isSprinting: true }, 0));
    expect(tierTwo).toBeCloseTo(tierOne * 1.5, 6);
    expect(sprinting).toBeCloseTo(tierOne * 2, 6);
  });

  it('grows a second tail at tier III, spread to either side', () => {
    expect(flagellumTailCount(1)).toBe(1);
    expect(flagellumTailCount(3)).toBe(2);
    const left = flagellumPolyline({ ...spec, tier: 3 }, 0).at(-1)!;
    const right = flagellumPolyline({ ...spec, tier: 3 }, 1).at(-1)!;
    expect(Math.sign(left.y - 50)).toBe(-Math.sign(right.y - 50));
  });

  it('travels: the wave moves along the tail over time and per cosmetic phase', () => {
    const before = flagellumPolyline({ ...spec, timeSeconds: 0 }, 0)[4]!;
    const after = flagellumPolyline({ ...spec, timeSeconds: 0.05 }, 0)[4]!;
    const shifted = flagellumPolyline({ ...spec, phase: 0.25 }, 0)[4]!;
    expect(after.y).not.toBeCloseTo(before.y, 6);
    expect(shifted.y).not.toBeCloseTo(before.y, 6);
  });
});

describe('FlagellumLines', () => {
  it('draws one polyline per tail into its graphics with round joins, and clears with no specs', () => {
    expect(FLAGELLUM_SEGMENTS).toBe(32);
    const lines = new FlagellumLines();
    const stroke = vi.spyOn(lines.graphics, 'stroke');
    expect(lines.update([spec, { ...spec, tier: 3 }], 1.5)).toBe(3);
    expect(stroke).toHaveBeenCalledTimes(2);
    for (const call of stroke.mock.calls) expect(call[0]).toMatchObject({ cap: 'round', join: 'round' });
    expect(lines.update([], 1)).toBe(0);
    lines.destroy();
  });

  it('reuses its pooled point arrays across frames instead of allocating per tail', () => {
    const lines = new FlagellumLines();
    const polyline = vi.spyOn(lines.graphics, 'moveTo');
    lines.update([spec], 1);
    lines.update([{ ...spec, timeSeconds: 0.2 }], 1);
    const pool = (lines as unknown as { pool: unknown[][] }).pool;
    expect(pool).toHaveLength(1);
    expect(pool[0]).toHaveLength(FLAGELLUM_SEGMENTS + 1);
    expect(polyline).toHaveBeenCalledTimes(4);
    lines.destroy();
  });
});
