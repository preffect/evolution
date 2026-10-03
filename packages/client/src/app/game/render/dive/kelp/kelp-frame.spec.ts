// @vitest-environment node
// One frame of the kelp band (docs/rendering/opening-dive.md §4): each part drawn by the mockup's own test at the
// lobby's stage (830 × 467): its size on screen, its zoom cut, a grid's cell cap; the two bands' fades; the foam's
// flicker, the close barnacles' fade and how far the camera is inside the drop.

import { describe, expect, it } from 'vitest';
import { KELP_RIBBON_REACH } from '../../constants/dive-kelp';
import { SHORE_BOULDER } from '../../constants/dive-shore-boulders';
import { smoothstep } from '../../geometry';
import { diveViewAt } from '../dive-view';
import { isKelpFrameShown, kelpFrameOf } from './kelp-frame';

const VIEWPORT = { width: 830, height: 467 };
const frameAt = (zoom: number, timeSeconds = 0) =>
  kelpFrameOf(diveViewAt({ zoom, viewport: VIEWPORT, timeSeconds, isMoving: false, globeIdleSpinDegrees: 0 }));

describe('kelpFrameOf', () => {
  it('draws nothing above the kelp’s band, nor past the drop’s', () => {
    expect(isKelpFrameShown(frameAt(3))).toBe(false);
    expect(isKelpFrameShown(frameAt(-3))).toBe(false);
  });

  it('fades the rock in first, a few pixels across, before the blades, the bulb and the stipe are a pixel wide', () => {
    const fading = frameAt(2.3);
    expect(fading.kelpAlpha).toBeGreaterThan(0);
    expect(fading.kelpAlpha).toBeLessThan(1);
    expect(fading.isRockShown).toBe(true);
    expect([fading.hasBlades, fading.isBulbShown, fading.isStipeShown]).toEqual([false, false, false]);
    const nearer = frameAt(1.5);
    expect([nearer.hasBlades, nearer.isBulbShown, nearer.isStipeShown]).toEqual([true, true, false]);
    expect(frameAt(1).isStipeShown).toBe(true);
  });

  it('stops the stipe once the view is past the rock’s edge, and the kelp at its cut, where the blade floor takes over', () => {
    expect(frameAt(-0.29).isStipeShown).toBe(true);
    expect(frameAt(-0.3).isStipeShown).toBe(false);
    const atCut = frameAt(-1.42);
    expect([atCut.isRockShown, atCut.hasBlades, atCut.isBulbShown, atCut.isFloorShown]).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(frameAt(-1.43).isFloorShown).toBe(true);
    expect(frameAt(-1.41).hasBlades).toBe(true);
  });

  it('shows the drop once it is a pixel and a half across, until the camera is inside it', () => {
    expect(frameAt(0.2).isDropShown).toBe(false);
    expect(frameAt(0).isDropShown).toBe(true);
    expect(frameAt(-2.39).isDropShown).toBe(true);
    expect(frameAt(-2.4).isDropShown).toBe(false);
  });

  it('shows the beads by their own test, and fades the drop band in over its window', () => {
    expect(frameAt(-1).hasBeads).toBe(true);
    expect(frameAt(0.3).hasBeads).toBe(false);
    expect(frameAt(0.3).dropAlpha).toBeGreaterThan(0);
    expect(frameAt(0.3).dropAlpha).toBeLessThan(1);
    expect(frameAt(-1).dropAlpha).toBe(1);
  });

  it('fades the close barnacles in below 0.45, but only once the grid’s cells over the view fall under its cap', () => {
    expect(frameAt(0.5).barnacleAlpha).toBe(0);
    expect(frameAt(0.44).barnacleAlpha).toBe(0);
    expect(frameAt(0.2).barnacleAlpha).toBe(smoothstep(0.45, 0.05, 0.2));
    expect(frameAt(0).barnacleAlpha).toBe(1);
  });

  it('sinks the camera into the drop between −1.9 and −2.35', () => {
    expect(frameAt(-1.9).dropInside).toBe(0);
    expect(frameAt(-2.1).dropInside).toBe(smoothstep(-1.9, -2.35, -2.1));
    expect(frameAt(-2.35).dropInside).toBe(1);
  });

  it('flickers the foam on the ambient clock, and reaches the ribbons’ strokes a pixel and a half out', () => {
    const foam = SHORE_BOULDER.waterline.foam;
    expect(frameAt(1, 2).foamAlpha).toBe(foam.alpha + foam.flicker * Math.sin(2 * foam.rate + 999));
    const frame = frameAt(1);
    expect(frame.ribbonReachM).toBe(KELP_RIBBON_REACH.strokeM + KELP_RIBBON_REACH.px / frame.pixelsPerMetre);
    expect(frame.shadowReachM).toBe(KELP_RIBBON_REACH.px / frame.pixelsPerMetre);
    expect(frame.bladeWidthPx).toBeCloseTo(0.11 * frame.pixelsPerMetre, 12);
  });
});
