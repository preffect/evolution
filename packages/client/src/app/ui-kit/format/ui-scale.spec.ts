import { describe, expect, it } from 'vitest';
import {
  UI_REFERENCE_VIEWPORT_HEIGHT_PX,
  UI_REFERENCE_VIEWPORT_WIDTH_PX,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
} from '../ui-kit-constants';
import { uiScaleFor } from './ui-scale';

describe('uiScaleFor', () => {
  it('is 1 at the reference viewport', () => {
    expect(uiScaleFor(UI_REFERENCE_VIEWPORT_WIDTH_PX, UI_REFERENCE_VIEWPORT_HEIGHT_PX)).toBe(1);
  });

  it('pins the formula constants of docs/ui/layout.md §1', () => {
    expect([UI_REFERENCE_VIEWPORT_WIDTH_PX, UI_REFERENCE_VIEWPORT_HEIGHT_PX, UI_SCALE_MIN, UI_SCALE_MAX]).toEqual([
      1280, 800, 0.8, 1.5,
    ]);
  });

  it('takes the smaller of the two ratios, so a wide short window scales by its height', () => {
    const halfHeight = UI_REFERENCE_VIEWPORT_HEIGHT_PX / 2;
    expect(uiScaleFor(UI_REFERENCE_VIEWPORT_WIDTH_PX * 4, halfHeight)).toBe(UI_SCALE_MIN);
    expect(uiScaleFor(UI_REFERENCE_VIEWPORT_WIDTH_PX * 1.2, UI_REFERENCE_VIEWPORT_HEIGHT_PX * 1.1)).toBeCloseTo(1.1);
  });

  it('clamps to the floor on a small window and to the ceiling on a huge one', () => {
    expect(uiScaleFor(320, 240)).toBe(UI_SCALE_MIN);
    expect(uiScaleFor(UI_REFERENCE_VIEWPORT_WIDTH_PX * 10, UI_REFERENCE_VIEWPORT_HEIGHT_PX * 10)).toBe(UI_SCALE_MAX);
  });

  it('answers the floor for a box with no layout, so a detached host never reads NaN', () => {
    expect(uiScaleFor(0, 0)).toBe(UI_SCALE_MIN);
    expect(uiScaleFor(Number.NaN, Number.NaN)).toBe(UI_SCALE_MIN);
  });
});
