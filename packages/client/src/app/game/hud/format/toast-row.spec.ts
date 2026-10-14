// @vitest-environment node
// The toast row's bottom edge (docs/ui/overlays.md §3.6, §3.8): the pinned upgrade popup keeps under it.

import { describe, expect, it } from 'vitest';
import { UI_BODY_LINE_HEIGHT, UI_SPACE_S_PX } from '../../../ui-kit/ui-kit-constants';
import { UI_TYPE } from '../../render/constants';
import { HUD_MARGIN_PX } from '../hud-constants';
import { toastRowBottomPx } from './toast-row';

/** Half the last digit overlays.md §3.8 prints the row's bottom to. */
const PRINTED_TOLERANCE_PX = 0.05;

describe('toastRowBottomPx', () => {
  it('is the margin, the padding on both sides and one body line at scale 1', () => {
    const expectedPx = HUD_MARGIN_PX + UI_SPACE_S_PX + UI_TYPE.body.px * UI_BODY_LINE_HEIGHT + UI_SPACE_S_PX;
    expect(toastRowBottomPx({ width: 1280, height: 800 })).toBeCloseTo(expectedPx);
  });

  it.each([
    { width: 1024, height: 640, printedPx: 41.8 },
    { width: 1280, height: 800, printedPx: 52.3 },
    { width: 1920, height: 1080, printedPx: 70.6 },
  ])('reaches y $printedPx at $width × $height, scaled with the HUD', ({ width, height, printedPx }) => {
    expect(Math.abs(toastRowBottomPx({ width, height }) - printedPx)).toBeLessThanOrEqual(PRINTED_TOLERANCE_PX);
  });
});
