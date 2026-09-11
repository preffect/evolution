import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '@evolution/shared';
import { NOISE_STRIP_ROWS, NOISE_STRIP_WIDTH } from '../constants';
import { buildNoiseStrip, sampleNoiseStrip } from './noise-strip';

const TEST_SEED = 7;

describe('noise strip', () => {
  it('bakes the same bytes for the same seed and different bytes for another', () => {
    const first = buildNoiseStrip(createSeededRandom(TEST_SEED));
    const second = buildNoiseStrip(createSeededRandom(TEST_SEED));
    expect(first.bytes).toEqual(second.bytes);
    expect(first.bytes).toHaveLength(NOISE_STRIP_WIDTH * NOISE_STRIP_ROWS * 4);
    expect(buildNoiseStrip(createSeededRandom(TEST_SEED + 1)).bytes).not.toEqual(first.bytes);
  });

  it('samples periodically with linear filtering and wraps rows', () => {
    const strip = buildNoiseStrip(createSeededRandom(TEST_SEED));
    const sample = sampleNoiseStrip(strip, 2, 0.3);
    expect(sampleNoiseStrip(strip, 2, 1.3).jitter).toBeCloseTo(sample.jitter, 9);
    expect(sampleNoiseStrip(strip, 2 + NOISE_STRIP_ROWS, -0.7).lobes).toBeCloseTo(sample.lobes, 9);
    expect(Math.abs(sample.jitter)).toBeLessThanOrEqual(1);
    expect(Math.abs(sample.lobes)).toBeLessThanOrEqual(0.05);
  });

  it('reports the slope of the lerp between the two texels as the derivative', () => {
    const strip = buildNoiseStrip(createSeededRandom(TEST_SEED));
    const step = 1e-6;
    for (let unit = 0.05; unit < 1; unit += 0.1) {
      const before = sampleNoiseStrip(strip, 1, unit - step);
      const after = sampleNoiseStrip(strip, 1, unit + step);
      const here = sampleNoiseStrip(strip, 1, unit);
      const numericLobes = (after.lobes - before.lobes) / (2 * step * 2 * Math.PI);
      const numericJitter = (after.jitter - before.jitter) / (2 * step * 2 * Math.PI);
      expect(here.lobesDerivative).toBeCloseTo(numericLobes, 4);
      expect(here.jitterDerivative).toBeCloseTo(numericJitter, 4);
    }
  });

  it('keeps 16-bit precision: the lobes channel resolves steps far below a byte', () => {
    const strip = buildNoiseStrip(createSeededRandom(TEST_SEED));
    const values = new Set<number>();
    for (let column = 0; column < NOISE_STRIP_WIDTH; column += 1) {
      values.add(sampleNoiseStrip(strip, 0, (column + 0.5) / NOISE_STRIP_WIDTH).lobes);
    }
    expect(values.size).toBeGreaterThan(200);
  });
});
