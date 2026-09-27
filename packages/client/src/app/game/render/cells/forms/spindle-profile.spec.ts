// @vitest-environment node
// The euglena's spindle (#194, docs/rendering/cells.md §2.4, sheet 04): the sheet's aspect, unit area, a round nose
// and a pointed rear, a derivative the membrane distance can trust, and a peak that bounds it.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { SPINDLE_ASPECT } from '../../constants';
import { normalisedArea } from './form-profiles';
import { SPINDLE_PROFILE } from './spindle-profile';

const SAMPLES = 2880;
const QUARTER_TURN = Math.PI / 2;

const sampledAt = (index: number): number => (index / SAMPLES) * RADIANS_PER_FULL_TURN - Math.PI;
const radiusAt = (delta: number): number => SPINDLE_PROFILE.evaluate(delta).value;

/** The outline's curvature at `delta`, from three neighbouring points: large at a point, small at a round end. */
function curvatureAt(delta: number): number {
  const step = 1e-3;
  const [before, middle, after] = [delta - step, delta, delta + step].map((angle) => ({
    x: radiusAt(angle) * Math.cos(angle),
    y: radiusAt(angle) * Math.sin(angle),
  })) as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
  const sideA = Math.hypot(middle.x - before.x, middle.y - before.y);
  const sideB = Math.hypot(after.x - middle.x, after.y - middle.y);
  const sideC = Math.hypot(after.x - before.x, after.y - before.y);
  const twiceArea = Math.abs(
    (middle.x - before.x) * (after.y - before.y) - (after.x - before.x) * (middle.y - before.y),
  );
  return (2 * twiceArea) / (sideA * sideB * sideC);
}

describe('the spindle', () => {
  it('has unit area, so mass ∝ area holds for the euglena', () => {
    expect(normalisedArea(SPINDLE_PROFILE)).toBeCloseTo(1, 6);
  });

  it('is as long as sheet 04’s aspect over its width', () => {
    const length = radiusAt(0) + radiusAt(Math.PI);
    const width = radiusAt(QUARTER_TURN) + radiusAt(-QUARTER_TURN);
    expect(length / width).toBeCloseTo(SPINDLE_ASPECT, 6);
  });

  /** The flagellum leaves a round nose; the rear tapers to a point, so it reads as a spindle, not an ellipse. */
  it('is round at the nose and pointed at the rear', () => {
    expect(curvatureAt(Math.PI)).toBeGreaterThan(curvatureAt(0) * 4);
    expect(radiusAt(0)).toBeCloseTo(radiusAt(Math.PI), 6);
  });

  it('is symmetric about its axis', () => {
    for (let index = 0; index < 36; index += 1) {
      const delta = (index / 36) * Math.PI;
      expect(radiusAt(delta)).toBeCloseTo(radiusAt(-delta), 12);
    }
  });

  it('carries a derivative that matches its slope, near the tips included', () => {
    const step = 1e-6;
    const angles = [0.01, 0.05, 0.3, 1, QUARTER_TURN, 2, 2.8, 3.1, -0.4, -1.7, -3.05];
    for (const delta of angles) {
      const slope = (radiusAt(delta + step) - radiusAt(delta - step)) / (2 * step);
      expect(SPINDLE_PROFILE.evaluate(delta).derivative, `at ${delta}`).toBeCloseTo(slope, 5);
    }
  });

  /** The reach bounds multiply the peak in (`shape-terms.ts`); the tips are the furthest points, so it is exact. */
  it('reports a peak no angle beats, reached at the tips', () => {
    const widest = Math.max(...Array.from({ length: SAMPLES }, (_unused, index) => radiusAt(sampledAt(index))));
    expect(widest).toBeLessThanOrEqual(SPINDLE_PROFILE.peak);
    expect(radiusAt(0)).toBeCloseTo(SPINDLE_PROFILE.peak, 9);
  });
});
