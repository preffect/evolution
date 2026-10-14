// @vitest-environment node
// The kelp's ribbons (docs/rendering/opening-dive.md §4): the mockup's Catmull-Rom curves through its control points,
// sampled a few millimetres apart with their arc length and unit tangent; five blades narrow at the bulb and tapering
// to the tip, their margins ruffled differently on each side; blade 0 through the focus; the stipe swelling to the bulb.

import { describe, expect, it } from 'vitest';
import { KELP_BLADE, KELP_BLADE_POINTS, KELP_SPLINE, KELP_STIPE, KELP_STIPE_POINTS } from '../../constants/dive-kelp';
import { KELP_BLADE_ANGLE, bladeWidthM, catmullRomSamples, kelpBlades, kelpStipe } from './kelp-ribbons';

const SQUARE = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
] as const;

describe('catmullRomSamples', () => {
  it('passes through every control point, in order, starting at the first', () => {
    const samples = catmullRomSamples(SQUARE, 0.1);
    for (const [x, y] of SQUARE) {
      expect(samples.some((sample) => Math.hypot(sample.x - x, sample.y - y) < 1e-12)).toBe(true);
    }
    expect([samples[0]!.x, samples[0]!.y]).toEqual([0, 0]);
    expect([samples.at(-1)!.x, samples.at(-1)!.y]).toEqual([0, 1]);
  });

  it('samples each span at least twice, about `step` apart, measuring the arc length along the way', () => {
    const samples = catmullRomSamples(SQUARE, 0.1);
    // three spans of length 1 at 0.1: ten steps each, the first span's start counted once
    expect(samples).toHaveLength(31);
    expect(catmullRomSamples(SQUARE, 10)).toHaveLength(1 + (SQUARE.length - 1) * KELP_SPLINE.minSamplesPerSpan);
    for (let index = 1; index < samples.length; index += 1) {
      const step = Math.hypot(samples[index]!.x - samples[index - 1]!.x, samples[index]!.y - samples[index - 1]!.y);
      expect(samples[index]!.u - samples[index - 1]!.u).toBeCloseTo(step, 12);
    }
  });

  it('gives every sample a unit tangent along the curve', () => {
    const samples = catmullRomSamples(SQUARE, 0.05);
    for (const sample of samples) expect(Math.hypot(sample.tangentX, sample.tangentY)).toBeCloseTo(1, 12);
    expect(samples[0]!.tangentX).toBeGreaterThan(0.9);
    expect(samples.at(-1)!.tangentX).toBeLessThan(-0.9);
  });
});

describe('the kelp’s ribbons', () => {
  it('makes five blades from the bulb, each sampled every few millimetres', () => {
    const blades = kelpBlades();
    expect(blades).toHaveLength(KELP_BLADE_POINTS.length);
    for (const [index, blade] of blades.entries()) {
      const [bulbX, bulbY] = KELP_BLADE_POINTS[index]![0]!;
      expect([blade.samples[0]!.x, blade.samples[0]!.y]).toEqual([bulbX, bulbY]);
      expect(blade.lengthM / blade.samples.length).toBeLessThan(KELP_SPLINE.bladeStepM * 1.01);
    }
  });

  it('runs blade 0 through the focus, along the close-ups’ direction', () => {
    const blade = kelpBlades()[0]!;
    const nearest = blade.samples.reduce((best, sample) =>
      Math.hypot(sample.x, sample.y) < Math.hypot(best.x, best.y) ? sample : best,
    );
    expect(Math.hypot(nearest.x, nearest.y)).toBeLessThan(KELP_SPLINE.bladeStepM);
    const along = Math.atan2(nearest.tangentY, nearest.tangentX);
    expect(Math.abs(along - KELP_BLADE_ANGLE)).toBeLessThan(0.05);
  });

  it('narrows each blade to a quarter at the bulb and tapers it to its tip, its two margins ruffled apart', () => {
    for (const [index, blade] of kelpBlades().entries()) {
      const half = bladeWidthM(index) / 2;
      const first = blade.samples[0]!;
      expect(first.leftM / half).toBeGreaterThan(0.2);
      expect(first.leftM / half).toBeLessThan(0.3);
      const middle = blade.samples[Math.floor(blade.samples.length / 2)]!;
      expect(middle.leftM / half).toBeGreaterThan(0.8);
      expect(blade.samples.at(-1)!.leftM / half).toBeLessThan(0.2);
      expect(blade.samples.some((sample) => Math.abs(sample.leftM - sample.rightM) > 0.002)).toBe(true);
    }
  });

  it('widens blades 1 to 4 a tenth of blade 0’s width more each', () => {
    expect(bladeWidthM(0)).toBe(KELP_BLADE.widthM);
    expect(bladeWidthM(1)).toBeCloseTo(KELP_BLADE.widthM * 0.95, 12);
    expect(bladeWidthM(4)).toBeCloseTo(KELP_BLADE.widthM * 1.25, 12);
  });

  it('swells the stipe over its last metres to the bulb, thin out in the water', () => {
    const stipe = kelpStipe();
    const [holdfastX, holdfastY] = KELP_STIPE_POINTS[0]!;
    expect([stipe.samples[0]!.x, stipe.samples[0]!.y]).toEqual([holdfastX, holdfastY]);
    expect(stipe.samples[0]!.leftM).toBeCloseTo(KELP_STIPE.baseHalfWidthM, 12);
    expect(stipe.samples.at(-1)!.leftM).toBeCloseTo(KELP_STIPE.baseHalfWidthM + KELP_STIPE.swellM, 12);
    for (const sample of stipe.samples) expect(sample.rightM).toBe(sample.leftM);
  });

  it('makes them once a page', () => {
    expect(kelpBlades()).toBe(kelpBlades());
    expect(kelpStipe()).toBe(kelpStipe());
  });
});
