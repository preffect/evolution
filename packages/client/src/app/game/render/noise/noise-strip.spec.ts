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
    const at = sampleNoiseStrip(strip, 2, 0.3);
    expect(sampleNoiseStrip(strip, 2, 1.3).jitter).toBeCloseTo(at.jitter, 9);
    expect(sampleNoiseStrip(strip, 2 + NOISE_STRIP_ROWS, -0.7).lobes).toBeCloseTo(at.lobes, 9);
    expect(Math.abs(at.jitter)).toBeLessThanOrEqual(1);
    expect(Math.abs(at.lobes)).toBeLessThanOrEqual(0.05);
  });

  it('bakes derivatives that match a finite difference of the value channels', () => {
    const strip = buildNoiseStrip(createSeededRandom(TEST_SEED));
    const step = 1 / NOISE_STRIP_WIDTH;
    for (let unit = 0.05; unit < 1; unit += 0.1) {
      const before = sampleNoiseStrip(strip, 1, unit - step);
      const after = sampleNoiseStrip(strip, 1, unit + step);
      const here = sampleNoiseStrip(strip, 1, unit);
      const numericLobes = (after.lobes - before.lobes) / (2 * step * 2 * Math.PI);
      expect(Math.abs(here.lobesDerivative - numericLobes)).toBeLessThan(0.05);
    }
  });
});
