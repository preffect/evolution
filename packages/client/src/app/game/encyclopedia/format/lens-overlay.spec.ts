// The eyepiece's geometry (docs/ui/encyclopedia.md §11.4). jsdom draws nothing and measures nothing, so every
// assertion here is arithmetic over the numbers the overlay hands the template: where each ring's *edges* fall,
// where each tick starts and ends, and that none of it is written against the one diameter it ships at. How the
// drawing then reads is the rendered frames' question, and the PR's screenshots are where it is answered.

import { describe, expect, it } from 'vitest';
import { UI_RIM_PX } from '../../../ui-kit/ui-kit-constants';
import { PREVIEW_LENS_SAFE_RADIUS_FRACTION } from '../../render/constants/preview';
import { HALF } from '../../render/geometry';
import {
  ENCYCLOPEDIA_LENS_DIAMETER_PX,
  ENCYCLOPEDIA_LENS_INNER_RING_ALPHA,
  ENCYCLOPEDIA_LENS_LOADING_RING_RADIUS_FRACTION,
  ENCYCLOPEDIA_LENS_MAJOR_TICK_EVERY,
  ENCYCLOPEDIA_LENS_MAJOR_TICK_PX,
  ENCYCLOPEDIA_LENS_MINOR_TICK_PX,
  ENCYCLOPEDIA_LENS_RIM_PX,
  ENCYCLOPEDIA_LENS_TICK_ALPHA,
  ENCYCLOPEDIA_LENS_TICK_COUNT,
  ENCYCLOPEDIA_LENS_VIGNETTE_ALPHA,
  ENCYCLOPEDIA_LENS_VIGNETTE_START_FRACTION,
} from '../encyclopedia-constants';
import { ENCYCLOPEDIA_LENS_OVERLAY, lensOverlayGeometry, type LensTickLine } from './lens-overlay';

/** A second, deliberately different lens: what a geometry written against 300 cannot answer for. */
const OTHER_DIAMETER_PX = 480;

const PRECISION_DECIMALS = 3;

function radiusOf(point: { readonly x: number; readonly y: number }, centre: number): number {
  return Math.hypot(point.x - centre, point.y - centre);
}

function tickOuterRadius(tick: LensTickLine, centre: number): number {
  return radiusOf({ x: tick.x1, y: tick.y1 }, centre);
}

function tickInnerRadius(tick: LensTickLine, centre: number): number {
  return radiusOf({ x: tick.x2, y: tick.y2 }, centre);
}

function tickLength(tick: LensTickLine): number {
  return Math.hypot(tick.x2 - tick.x1, tick.y2 - tick.y1);
}

describe('lensOverlayGeometry (docs/ui/encyclopedia.md §11.4)', () => {
  const overlay = ENCYCLOPEDIA_LENS_OVERLAY;
  const centre = ENCYCLOPEDIA_LENS_DIAMETER_PX * HALF;

  it('is a square view box the lens diameter a side, centred', () => {
    expect(overlay.viewBox).toBe(`0 0 ${ENCYCLOPEDIA_LENS_DIAMETER_PX} ${ENCYCLOPEDIA_LENS_DIAMETER_PX}`);
    expect([overlay.centre, overlay.radius]).toEqual([centre, centre]);
  });

  it('puts the rim inside the lens edge and the inner ring inside the rim, neither overlapping the other', () => {
    const rimOuterEdge = overlay.rimRadius + overlay.rimWidth * HALF;
    const rimInnerEdge = overlay.rimRadius - overlay.rimWidth * HALF;
    const ringOuterEdge = overlay.innerRingRadius + overlay.hairlineWidth * HALF;
    expect(rimOuterEdge).toBe(centre);
    expect(rimInnerEdge).toBe(centre - ENCYCLOPEDIA_LENS_RIM_PX);
    expect(ringOuterEdge).toBe(rimInnerEdge);
    expect(overlay.hairlineWidth).toBe(UI_RIM_PX);
  });

  it('draws ENCYCLOPEDIA_LENS_TICK_COUNT ticks, every major one at its own length', () => {
    expect(overlay.ticks).toHaveLength(ENCYCLOPEDIA_LENS_TICK_COUNT);
    overlay.ticks.forEach((tick, index) => {
      const expected =
        index % ENCYCLOPEDIA_LENS_MAJOR_TICK_EVERY === 0
          ? ENCYCLOPEDIA_LENS_MAJOR_TICK_PX
          : ENCYCLOPEDIA_LENS_MINOR_TICK_PX;
      expect(tickLength(tick)).toBeCloseTo(expected, PRECISION_DECIMALS - 1);
    });
  });

  /**
   * The four majors are the quarters, and the first is at twelve o'clock: a reticle whose long marks sit between
   * the quarters reads as a misalignment rather than as a scale. Measured as positions, not as indices — the
   * length test above already knows which indices are major.
   */
  it('puts a major tick at each quarter, starting at twelve o’clock', () => {
    const majors = overlay.ticks.filter((_tick, index) => index % ENCYCLOPEDIA_LENS_MAJOR_TICK_EVERY === 0);
    const quarters = majors.map((tick) => [
      Number((tick.x1 - centre).toFixed(PRECISION_DECIMALS)),
      Number((tick.y1 - centre).toFixed(PRECISION_DECIMALS)),
    ]);
    const armLength = centre - ENCYCLOPEDIA_LENS_RIM_PX;
    expect(quarters).toEqual([
      [0, -armLength],
      [armLength, 0],
      [0, armLength],
      [-armLength, 0],
    ]);
  });

  it('runs every tick inward from the rim’s inner edge, never under the rim', () => {
    for (const tick of overlay.ticks) {
      expect(tickOuterRadius(tick, centre)).toBeCloseTo(centre - ENCYCLOPEDIA_LENS_RIM_PX, PRECISION_DECIMALS - 1);
      expect(tickInnerRadius(tick, centre)).toBeLessThan(tickOuterRadius(tick, centre));
    }
  });

  /**
   * The ticks live in the band between the rim and the safe circle a subject's body stays inside (§12.7), so a
   * reticle never crosses a cell. The assertion is the inequality itself: it fails if either the reticle grows
   * inward or `PREVIEW_LENS_SAFE_RADIUS_FRACTION` is widened toward it.
   */
  it('keeps every tick clear of the subject’s safe circle', () => {
    const safeRadius = centre * PREVIEW_LENS_SAFE_RADIUS_FRACTION;
    const innermost = Math.min(...overlay.ticks.map((tick) => tickInnerRadius(tick, centre)));
    expect(innermost).toBeGreaterThan(safeRadius);
  });

  it('carries the alphas and the vignette stop the constants declare', () => {
    expect(overlay.innerRingOpacity).toBe(ENCYCLOPEDIA_LENS_INNER_RING_ALPHA);
    expect(overlay.tickOpacity).toBe(ENCYCLOPEDIA_LENS_TICK_ALPHA);
    expect(overlay.vignetteOpacity).toBe(ENCYCLOPEDIA_LENS_VIGNETTE_ALPHA);
    expect(overlay.vignetteStartOffset).toBe(ENCYCLOPEDIA_LENS_VIGNETTE_START_FRACTION);
  });

  it('puts the loading ring at its fraction of the radius', () => {
    expect(overlay.loadingRingRadius).toBe(centre * ENCYCLOPEDIA_LENS_LOADING_RING_RADIUS_FRACTION);
  });

  /**
   * Nothing above is written against 300: at another diameter the centre, both rings and the reticle follow it,
   * while the rim and the tick lengths stay the px lengths they are declared as.
   */
  it('follows the diameter it is given rather than the one it ships at', () => {
    const wider = lensOverlayGeometry(OTHER_DIAMETER_PX);
    const widerCentre = OTHER_DIAMETER_PX * HALF;
    expect([wider.centre, wider.radius]).toEqual([widerCentre, widerCentre]);
    expect(wider.rimRadius + wider.rimWidth * HALF).toBe(widerCentre);
    expect(wider.rimWidth).toBe(ENCYCLOPEDIA_LENS_RIM_PX);
    expect(wider.loadingRingRadius).toBe(widerCentre * ENCYCLOPEDIA_LENS_LOADING_RING_RADIUS_FRACTION);
    const [firstTick] = wider.ticks;
    if (firstTick === undefined) throw new Error('a lens of any diameter has a reticle');
    expect(tickOuterRadius(firstTick, widerCentre)).toBeCloseTo(widerCentre - ENCYCLOPEDIA_LENS_RIM_PX);
  });
});
