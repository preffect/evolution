import { INTEREST_VIEW_ASPECT_RATIO } from '@evolution/shared';
import { Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { applyBandEdgeFades, createBandEdgeFades, type BandEdgeFades } from './band-edge-fade';
import { BAND_EDGE_FADE_EDGE_STOP, BAND_EDGE_FADE_WIDTH_VIEW_FRACTION } from './constants';

/** A sprite's screen span on x: a mirrored sprite (negative scale) reaches left of its position. */
function spanOf(sprite: BandEdgeFades['left']): { left: number; right: number } {
  const bounds = sprite.getBounds();
  return { left: bounds.x, right: bounds.x + bounds.width };
}

describe('applyBandEdgeFades (#684)', () => {
  const viewport = { width: 3000, height: 1000 };
  const bandWidth = INTEREST_VIEW_ASPECT_RATIO * viewport.height;
  const bandLeft = (viewport.width - bandWidth) / 2;
  const fadeWidth = BAND_EDGE_FADE_WIDTH_VIEW_FRACTION * viewport.height;
  const insideWidth = BAND_EDGE_FADE_EDGE_STOP * fadeWidth;
  const outsideWidth = fadeWidth - insideWidth;

  it('lays one fade over each band edge, its edge stop on the edge, full height, past the interest aspect', () => {
    const fades = createBandEdgeFades(Texture.WHITE);
    applyBandEdgeFades(fades, viewport);
    expect([fades.left.visible, fades.right.visible]).toEqual([true, true]);
    const left = spanOf(fades.left);
    const right = spanOf(fades.right);
    expect(outsideWidth).toBeGreaterThan(0);
    expect(left.left).toBeCloseTo(bandLeft - outsideWidth, 6);
    expect(left.right).toBeCloseTo(bandLeft + insideWidth, 6);
    expect(right.left).toBeCloseTo(bandLeft + bandWidth - insideWidth, 6);
    expect(right.right).toBeCloseTo(bandLeft + bandWidth + outsideWidth, 6);
    for (const fade of [fades.left, fades.right]) expect(fade.getBounds().height).toBeCloseTo(viewport.height, 6);
  });

  it('mirrors the left fade, so both ramps run from the middle of the band out across its edge', () => {
    const fades = createBandEdgeFades(Texture.WHITE);
    applyBandEdgeFades(fades, viewport);
    expect(fades.right.scale.x).toBeGreaterThan(0);
    expect(fades.left.scale.x).toBeCloseTo(-fades.right.scale.x, 10);
    expect(fades.left.texture).toBe(fades.right.texture);
  });

  it('hides both fades once the canvas is no wider than the interest aspect, and shows them again past it', () => {
    const fades = createBandEdgeFades(Texture.WHITE);
    applyBandEdgeFades(fades, viewport);
    for (const narrower of [
      { width: 1920, height: 1080 },
      { width: INTEREST_VIEW_ASPECT_RATIO * 1000, height: 1000 },
    ]) {
      applyBandEdgeFades(fades, narrower);
      expect([fades.left.visible, fades.right.visible]).toEqual([false, false]);
    }
    applyBandEdgeFades(fades, viewport);
    expect([fades.left.visible, fades.right.visible]).toEqual([true, true]);
  });
});
