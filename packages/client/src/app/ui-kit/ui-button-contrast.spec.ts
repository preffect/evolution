// @vitest-environment node
// The button family's edges against the panel ground (docs/ui/components-and-constants.md §10.2,
// docs/visual-style/principles-and-palette.md §2): every rim a control is found by clears the 3:1 bar for a
// control's boundary on both ends of the panel gradient, and the ranks stay apart, so a secondary button never
// reads as loud as the primary one (#596).
import { describe, expect, it } from 'vitest';
import { DANGER, PANEL_BOTTOM, PANEL_TOP, TEXT, TEXT_LABEL, UI_ACCENT } from '../game/render/constants/colours';
import { contrastRatio, hexOver } from '../../testing/colour-difference';
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
/** A variant without a fill (danger): its rim sits straight on the ground. */
const NO_FILL = 0;

/** A variant's rim and fill, each a colour at an alpha. */
interface ButtonEdge {
  readonly rim: string;
  readonly rimAlpha: number;
  readonly fill: string;
  readonly fillAlpha: number;
}

/** The rim over the button's own fill, measured against the bare ground around the button. */
function edgeContrast(edge: ButtonEdge, ground: string): number {
  return contrastRatio(hexOver(edge.rim, edge.rimAlpha, hexOver(edge.fill, edge.fillAlpha, ground)), ground);
}

const SECONDARY: ButtonEdge = {
  rim: TEXT_LABEL,
  rimAlpha: UI_SECONDARY_RIM_ALPHA,
  fill: TEXT,
  fillAlpha: UI_SECONDARY_FILL_ALPHA,
};
const PRIMARY: ButtonEdge = {
  rim: UI_ACCENT,
  rimAlpha: UI_PRIMARY_RIM_ALPHA,
  fill: UI_ACCENT,
  fillAlpha: UI_PRIMARY_FILL_ALPHA,
};
const DANGER_EDGE: ButtonEdge = { rim: DANGER, rimAlpha: UI_DANGER_RIM_ALPHA, fill: DANGER, fillAlpha: NO_FILL };

describe.each([
  ['PANEL_TOP', PANEL_TOP],
  ['PANEL_BOTTOM', PANEL_BOTTOM],
])('the button edges on %s', (_name, ground) => {
  it(`gives a secondary button an edge of at least ${BOUNDARY_CONTRAST_MIN}:1`, () => {
    expect(edgeContrast(SECONDARY, ground)).toBeGreaterThanOrEqual(BOUNDARY_CONTRAST_MIN);
  });

  it('keeps the primary edge well above the secondary one, so the rank still reads', () => {
    expect(edgeContrast(PRIMARY, ground)).toBeGreaterThan(edgeContrast(SECONDARY, ground) * PRIMARY_OVER_SECONDARY_MIN);
  });

  it(`gives a danger button an edge of at least ${BOUNDARY_CONTRAST_MIN}:1`, () => {
    expect(edgeContrast(DANGER_EDGE, ground)).toBeGreaterThanOrEqual(BOUNDARY_CONTRAST_MIN);
  });
});
