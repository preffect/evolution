import { describe, expect, it } from 'vitest';
import { ARC_INSTANCE_FIELD, DANGER, DNA, LADDER_ORBIT_ANGLES_PAIR_DEG } from '../constants';
import { ARC_INSTANCE_FLOATS, packArcInstances, type ArcInstance } from './arc-instance';

const ZOOM = 2;
const FIELD = ARC_INSTANCE_FIELD;

function arc(overrides: Partial<ArcInstance> = {}): ArcInstance {
  return { x: 10, y: -20, radiusPx: 45, strokePx: 4, startDeg: 0, sweep: 0.5, colour: DNA, alpha: 1, ...overrides };
}

function pack(arcs: readonly ArcInstance[], capacity = 4) {
  const target = new Float32Array(capacity * ARC_INSTANCE_FLOATS);
  const count = packArcInstances(arcs, ZOOM, target, capacity);
  const row = (index: number, field: keyof typeof FIELD) => target[index * ARC_INSTANCE_FLOATS + FIELD[field]]!;
  return { count, row };
}

/** Where the row's angle lands on a y-down screen, as the shader places the arc's end: `radius (cos, sin)`. */
function pointAt(radians: number, radius: number) {
  return { x: Math.cos(radians) * radius, y: Math.sin(radians) * radius };
}

describe('packArcInstances', () => {
  it('writes the centre in world units and the radius and half stroke from px through the zoom', () => {
    const { count, row } = pack([arc()]);
    expect(count).toBe(1);
    expect([row(0, 'x'), row(0, 'y')]).toEqual([10, -20]);
    expect(row(0, 'radius')).toBe(45 / ZOOM);
    expect(row(0, 'halfStroke')).toBe(4 / 2 / ZOOM);
  });

  it('turns the record angle (clockwise from 12) into the screen angle, so 0 / 90 / 180 land at 12 / 3 / 6 o’clock', () => {
    // Mutation-checked: dropping the quarter turn, or reversing the sense of rotation, moves every point below.
    const cases = [
      { startDeg: 0, expected: { x: 0, y: -1 } },
      { startDeg: 90, expected: { x: 1, y: 0 } },
      { startDeg: 180, expected: { x: 0, y: 1 } },
      { startDeg: LADDER_ORBIT_ANGLES_PAIR_DEG.aerobic, expected: { x: -Math.SQRT1_2, y: Math.SQRT1_2 } },
      { startDeg: LADDER_ORBIT_ANGLES_PAIR_DEG.photosynthetic, expected: { x: Math.SQRT1_2, y: Math.SQRT1_2 } },
    ];
    const { row } = pack(
      cases.map(({ startDeg }) => arc({ startDeg })),
      cases.length,
    );
    cases.forEach(({ expected }, index) => {
      const point = pointAt(row(index, 'startRadians'), 1);
      expect(point.x, `start ${cases[index]!.startDeg}°`).toBeCloseTo(expected.x, 6);
      expect(point.y, `start ${cases[index]!.startDeg}°`).toBeCloseTo(expected.y, 6);
    });
  });

  it('sweeps clockwise: a quarter from 12 o’clock ends at 3 o’clock; a whole turn or more is the full ring', () => {
    const { row } = pack([arc({ startDeg: 0, sweep: 0.25 }), arc({ sweep: 1 }), arc({ sweep: 3 })]);
    const end = pointAt(row(0, 'startRadians') + row(0, 'sweepRadians'), 1);
    expect(end.x).toBeCloseTo(1, 6);
    expect(end.y).toBeCloseTo(0, 6);
    expect(row(1, 'sweepRadians')).toBeCloseTo(2 * Math.PI, 6);
    expect(row(2, 'sweepRadians')).toBeCloseTo(2 * Math.PI, 6);
  });

  it('writes a straight colour and its alpha, the shader premultiplies', () => {
    const { row } = pack([arc({ colour: DANGER, alpha: 0.2 })]);
    expect([row(0, 'red'), row(0, 'green'), row(0, 'blue')].map((channel) => Math.round(channel * 255))).toEqual([
      0xff, 0x54, 0x70,
    ]);
    expect(row(0, 'alpha')).toBeCloseTo(0.2, 6);
  });

  it('drops an arc that covers nothing (a round cap would leave a dot) and stops at the capacity', () => {
    expect(pack([arc({ sweep: 0 }), arc({ alpha: 0 }), arc({ strokePx: 0 })]).count).toBe(0);
    const { count, row } = pack([arc({ sweep: 0 }), arc({ radiusPx: 17 })]);
    expect(count).toBe(1);
    expect(row(0, 'radius')).toBe(17 / ZOOM);
    expect(
      pack(
        Array.from({ length: 6 }, () => arc()),
        4,
      ).count,
    ).toBe(4);
  });
});
