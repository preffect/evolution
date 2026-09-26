// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MILLISECONDS_PER_SECOND, RECONCILE_BLEND_SECONDS, RECONCILE_SNAP_DISTANCE_WU } from '@evolution/shared';
import { PoseCorrection } from './pose-correction';

const BLEND_MS = RECONCILE_BLEND_SECONDS * MILLISECONDS_PER_SECOND;
const ORIGIN = { x: 0, y: 0 };
const SMALL_GAP = 10;

describe('PoseCorrection', () => {
  it('draws the prediction itself before any correction', () => {
    expect(new PoseCorrection().displayed({ x: 5, y: 6 }, 0)).toEqual({ x: 5, y: 6 });
  });

  it('starts a small gap where the cell was drawn and blends it out linearly over the blend time', () => {
    const correction = new PoseCorrection();
    const start = 1000;
    correction.rebase({ x: SMALL_GAP, y: 0 }, ORIGIN, start);
    expect(correction.displayed(ORIGIN, start)).toEqual({ x: SMALL_GAP, y: 0 });
    expect(correction.displayed(ORIGIN, start + BLEND_MS / 2).x).toBeCloseTo(SMALL_GAP / 2, 9);
    expect(correction.displayed(ORIGIN, start + BLEND_MS).x).toBe(0);
    expect(correction.displayed(ORIGIN, start + BLEND_MS * 3).x).toBe(0);
  });

  it('snaps a gap at the snap distance, and one with nothing drawn before it', () => {
    const correction = new PoseCorrection();
    correction.rebase({ x: RECONCILE_SNAP_DISTANCE_WU, y: 0 }, ORIGIN, 0);
    expect(correction.displayed(ORIGIN, 0)).toEqual(ORIGIN);
    correction.rebase({ x: RECONCILE_SNAP_DISTANCE_WU - 1, y: 0 }, ORIGIN, 0);
    expect(correction.displayed(ORIGIN, 0).x).toBe(RECONCILE_SNAP_DISTANCE_WU - 1);
    correction.rebase(null, ORIGIN, 0);
    expect(correction.displayed(ORIGIN, 0)).toEqual(ORIGIN);
  });

  it('forgets the offset on reset', () => {
    const correction = new PoseCorrection();
    correction.rebase({ x: SMALL_GAP, y: SMALL_GAP }, ORIGIN, 0);
    correction.reset();
    expect(correction.displayed(ORIGIN, 0)).toEqual(ORIGIN);
  });
});
