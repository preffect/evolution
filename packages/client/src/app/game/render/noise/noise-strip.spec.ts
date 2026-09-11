import { describe, expect, it } from 'vitest';
import { RADIANS_PER_FULL_TURN, RANDOM_STREAM, createSeededRandom } from '@evolution/shared';
import { areBytesEqual } from '../../../../testing/bytes';
import {
  NOISE_STRIP_LOBE_SCALE,
  NOISE_STRIP_ROWS,
  NOISE_STRIP_WIDTH,
  REST_LOBE_COUNT_MAX,
  REST_LOBE_COUNT_MIN,
} from '../constants';
import { buildNoiseStrip, sampleNoiseStrip } from './noise-strip';

const TEST_SEED = 7;
const RGBA = 4;

function cosmetic(seed = TEST_SEED) {
  return createSeededRandom(seed).fork(RANDOM_STREAM.cosmetic);
}

describe('noise strip', () => {
  it('bakes the same bytes for the same seed and different bytes for another', () => {
    const first = buildNoiseStrip(cosmetic());
    expect(areBytesEqual(first.bytes, buildNoiseStrip(cosmetic()).bytes)).toBe(true);
    expect(first.bytes).toHaveLength(NOISE_STRIP_WIDTH * NOISE_STRIP_ROWS * RGBA);
    expect([first.width, first.rows]).toEqual([NOISE_STRIP_WIDTH, NOISE_STRIP_ROWS]);
    expect(areBytesEqual(buildNoiseStrip(cosmetic(TEST_SEED + 1)).bytes, first.bytes)).toBe(false);
  });

  it('gives every row 5–7 rest lobes within the amplitude bound', () => {
    const strip = buildNoiseStrip(cosmetic());
    expect(strip.lobeCounts).toHaveLength(NOISE_STRIP_ROWS);
    for (const count of strip.lobeCounts) {
      expect(count).toBeGreaterThanOrEqual(REST_LOBE_COUNT_MIN);
      expect(count).toBeLessThanOrEqual(REST_LOBE_COUNT_MAX);
    }
    for (let column = 0; column < NOISE_STRIP_WIDTH; column += 1) {
      expect(Math.abs(sampleNoiseStrip(strip, 0, column / NOISE_STRIP_WIDTH).lobes)).toBeLessThanOrEqual(
        NOISE_STRIP_LOBE_SCALE,
      );
    }
  });

  it('samples periodically with linear filtering and wraps rows', () => {
    const strip = buildNoiseStrip(cosmetic());
    const sample = sampleNoiseStrip(strip, 2, 0.3);
    expect(sampleNoiseStrip(strip, 2, 1.3).jitter).toBeCloseTo(sample.jitter, 9);
    expect(sampleNoiseStrip(strip, 2 + NOISE_STRIP_ROWS, -0.7).lobes).toBeCloseTo(sample.lobes, 9);
    expect(Math.abs(sample.jitter)).toBeLessThanOrEqual(1);
  });

  it('reports the slope of the lerp between the two texels as the derivative', () => {
    const strip = buildNoiseStrip(cosmetic());
    const step = 1e-6;
    for (let unit = 0.05; unit < 1; unit += 0.1) {
      const before = sampleNoiseStrip(strip, 1, unit - step);
      const after = sampleNoiseStrip(strip, 1, unit + step);
      const here = sampleNoiseStrip(strip, 1, unit);
      const radians = 2 * step * RADIANS_PER_FULL_TURN;
      expect(here.lobesDerivative).toBeCloseTo((after.lobes - before.lobes) / radians, 4);
      expect(here.jitterDerivative).toBeCloseTo((after.jitter - before.jitter) / radians, 4);
    }
  });

  it('keeps 16-bit precision: the lobes channel resolves steps far below a byte', () => {
    const strip = buildNoiseStrip(cosmetic());
    const values = new Set<number>();
    for (let column = 0; column < NOISE_STRIP_WIDTH; column += 1) {
      values.add(sampleNoiseStrip(strip, 0, (column + 0.5) / NOISE_STRIP_WIDTH).lobes);
    }
    expect(values.size).toBeGreaterThan(200);
  });
});
