// @vitest-environment node
// The button family's edges against the panel ground (docs/ui/components-and-constants.md §10.2,
// docs/visual-style/principles-and-palette.md §2): every rim a control is found by clears the 3:1 bar for a
// control's boundary on both ends of the panel gradient, and the ranks stay apart, so a secondary button never
// reads as loud as the primary one (#596).
import { describe, expect, it } from 'vitest';
import { hexToRgb, type Rgb } from '../game/render/colour';
import { DANGER, PANEL_BOTTOM, PANEL_TOP, TEXT, TEXT_LABEL, UI_ACCENT } from '../game/render/constants/colours';
import { relativeLuminance } from '../../testing/colour-difference';
import {
  UI_DANGER_RIM_ALPHA,
  UI_PRIMARY_FILL_ALPHA,
  UI_PRIMARY_RIM_ALPHA,
  UI_SECONDARY_FILL_ALPHA,
  UI_SECONDARY_RIM_ALPHA,
} from './ui-kit-constants';

/** WCAG's bar for a control's boundary against what surrounds it. */
const BOUNDARY_CONTRAST_MIN = 3;
/** How much further the primary edge must stand out than the secondary one: the rank, not only the bar. */
const PRIMARY_OVER_SECONDARY_MIN = 1.5;
/** WCAG's luminance offset in the contrast ratio. */
const CONTRAST_OFFSET = 0.05;

/** `color-mix(in srgb, top alpha, transparent)` painted over `ground`. */
function over(top: Rgb, alpha: number, ground: Rgb): Rgb {
  return [0, 1, 2].map((channel) => top[channel]! * alpha + ground[channel]! * (1 - alpha)) as unknown as Rgb;
}

function contrast(first: Rgb, second: Rgb): number {
  const [light, dark] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (light! + CONTRAST_OFFSET) / (dark! + CONTRAST_OFFSET);
}

/** A rim over the button's own fill, measured against the bare ground around the button. */
function rimContrast(rim: string, rimAlpha: number, fill: string, fillAlpha: number, ground: string): number {
  const groundRgb = hexToRgb(ground);
  const underRim = over(hexToRgb(fill), fillAlpha, groundRgb);
  return contrast(over(hexToRgb(rim), rimAlpha, underRim), groundRgb);
}

describe.each([
  ['PANEL_TOP', PANEL_TOP],
  ['PANEL_BOTTOM', PANEL_BOTTOM],
])('the button edges on %s', (_name, ground) => {
  const secondary = rimContrast(TEXT_LABEL, UI_SECONDARY_RIM_ALPHA, TEXT, UI_SECONDARY_FILL_ALPHA, ground);
  const primary = rimContrast(UI_ACCENT, UI_PRIMARY_RIM_ALPHA, UI_ACCENT, UI_PRIMARY_FILL_ALPHA, ground);

  it(`gives a secondary button an edge of at least ${BOUNDARY_CONTRAST_MIN}:1`, () => {
    expect(secondary).toBeGreaterThanOrEqual(BOUNDARY_CONTRAST_MIN);
  });

  it('keeps the primary edge well above the secondary one, so the rank still reads', () => {
    expect(primary).toBeGreaterThan(secondary * PRIMARY_OVER_SECONDARY_MIN);
  });

  it(`gives a danger button an edge of at least ${BOUNDARY_CONTRAST_MIN}:1`, () => {
    expect(
      contrast(over(hexToRgb(DANGER), UI_DANGER_RIM_ALPHA, hexToRgb(ground)), hexToRgb(ground)),
    ).toBeGreaterThanOrEqual(BOUNDARY_CONTRAST_MIN);
  });
});
