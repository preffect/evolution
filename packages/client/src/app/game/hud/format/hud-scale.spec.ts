import { describe, expect, it } from 'vitest';
import {
  HUD_REFERENCE_VIEWPORT_HEIGHT_PX,
  HUD_REFERENCE_VIEWPORT_WIDTH_PX,
  HUD_SCALE_MAX,
  HUD_SCALE_MIN,
} from '../hud-constants';
import { hudScaleFor } from './hud-scale';

describe('hudScaleFor', () => {
  it('is 1 at the reference viewport', () => {
    expect(hudScaleFor(HUD_REFERENCE_VIEWPORT_WIDTH_PX, HUD_REFERENCE_VIEWPORT_HEIGHT_PX)).toBe(1);
  });

  it('takes the smaller of the two ratios, so a wide short window scales by its height', () => {
    const halfHeight = HUD_REFERENCE_VIEWPORT_HEIGHT_PX / 2;
    expect(hudScaleFor(HUD_REFERENCE_VIEWPORT_WIDTH_PX * 4, halfHeight)).toBe(HUD_SCALE_MIN);
    expect(hudScaleFor(HUD_REFERENCE_VIEWPORT_WIDTH_PX * 1.2, HUD_REFERENCE_VIEWPORT_HEIGHT_PX * 1.1)).toBeCloseTo(1.1);
  });

  it('clamps to the floor on a small window and to the ceiling on a huge one', () => {
    expect(hudScaleFor(320, 240)).toBe(HUD_SCALE_MIN);
    expect(hudScaleFor(HUD_REFERENCE_VIEWPORT_WIDTH_PX * 10, HUD_REFERENCE_VIEWPORT_HEIGHT_PX * 10)).toBe(
      HUD_SCALE_MAX,
    );
  });

  it('answers the floor for a box with no layout, so a detached host never reads NaN', () => {
    expect(hudScaleFor(0, 0)).toBe(HUD_SCALE_MIN);
    expect(hudScaleFor(Number.NaN, Number.NaN)).toBe(HUD_SCALE_MIN);
  });
});
