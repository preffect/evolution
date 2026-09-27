// @vitest-environment node
// The paramecium's slipper (#193, docs/rendering/cells.md §2.4, sheet 04): the tier's aspect, unit area, a blunt
// front, the oral groove on one flank only, a derivative the membrane distance can trust, and a peak that bounds it.

import { RADIANS_PER_FULL_TURN, type TraitTier } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { SLIPPER_ASPECT_BY_TIER, SLIPPER_ORAL_GROOVE_DEG } from '../../constants';
import { degreesToRadians } from '../../geometry';
import { normalisedArea } from './form-profiles';
import { SLIPPER_SHAPES, slipperProfileAt, slipperShapeAt } from './slipper-profile';

const TIERS: readonly TraitTier[] = [1, 2, 3];
const SAMPLES = 1440;
const GROOVE = degreesToRadians(SLIPPER_ORAL_GROOVE_DEG);

function sampled(tier: TraitTier): number[] {
  const profile = slipperProfileAt(tier);
  return Array.from(
    { length: SAMPLES },
    (_unused, index) => profile.evaluate((index / SAMPLES) * RADIANS_PER_FULL_TURN - Math.PI).value,
  );
}

describe('the slipper', () => {
  it('has unit area at every tier, so mass ∝ area holds for the paramecium', () => {
    for (const tier of TIERS) expect(normalisedArea(slipperProfileAt(tier))).toBeCloseTo(1, 6);
  });

  /** Nose to tail over flank to flank: the tier's aspect, give or take what the blunt front and the groove move. */
  it('is as long as the tier’s aspect over its width, and longer each tier', () => {
    const lengths = TIERS.map((tier) => {
      const profile = slipperProfileAt(tier);
      const length = profile.evaluate(0).value + profile.evaluate(Math.PI).value;
      const width = profile.evaluate(-Math.PI / 2).value * 2;
      return length / width;
    });
    lengths.forEach((ratio, index) => expect(ratio).toBeCloseTo(SLIPPER_ASPECT_BY_TIER[index] ?? 0, 1));
    expect(lengths[1]).toBeGreaterThan(lengths[0] ?? 0);
    expect(lengths[2]).toBeGreaterThan(lengths[1] ?? 0);
  });

  it('is blunter at the front than at the rear', () => {
    for (const tier of TIERS) {
      const profile = slipperProfileAt(tier);
      expect(profile.evaluate(0).value).toBeGreaterThan(profile.evaluate(Math.PI).value);
    }
  });

  /** The notch that makes it a slipper rather than an egg: on one flank, the mirror flank untouched. */
  it('is notched by the oral groove on one flank only', () => {
    for (const tier of TIERS) {
      const profile = slipperProfileAt(tier);
      expect(profile.evaluate(GROOVE).value / profile.evaluate(-GROOVE).value).toBeLessThan(0.9);
    }
  });

  it('carries a derivative that matches its slope, groove included', () => {
    const step = 1e-5;
    for (const tier of TIERS) {
      const profile = slipperProfileAt(tier);
      for (let index = 0; index < 72; index += 1) {
        const delta = (index / 72) * RADIANS_PER_FULL_TURN - Math.PI + 0.01;
        const slope = (profile.evaluate(delta + step).value - profile.evaluate(delta - step).value) / (2 * step);
        expect(profile.evaluate(delta).derivative).toBeCloseTo(slope, 5);
      }
    }
  });

  /** The reach bounds multiply the peak in (`shape-terms.ts`), so it must bound every angle, and not loosely. */
  it('reports a peak no angle beats, within 1 % of the widest', () => {
    for (const tier of TIERS) {
      const widest = Math.max(...sampled(tier));
      const { peak } = slipperProfileAt(tier);
      expect(widest).toBeLessThanOrEqual(peak);
      expect(widest / peak).toBeGreaterThan(0.99);
    }
  });

  it('falls back to tier I past the table, and bakes one shape per tier', () => {
    expect(SLIPPER_SHAPES.map((shape) => shape.aspect)).toEqual([...SLIPPER_ASPECT_BY_TIER]);
    expect(slipperShapeAt(4 as TraitTier)).toBe(SLIPPER_SHAPES[0]);
    expect(slipperProfileAt(4 as TraitTier)).toBe(slipperProfileAt(1));
  });
});
