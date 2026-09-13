// The own-cell indicators' constants (docs/UI.md §9, whose table owns every value; the home is
// `render/constants.ts` because the renderer applies them). Only the rows the derived record needs
// are here — the orbit angles, which `ownCellIndicatorsFor` puts on each ladder counter. The
// geometry rows (radii, strokes, pip sizes, alphas) arrive with the drawing side, #187.

// These are **degrees, clockwise from 12 o'clock** (docs/UI.md §3.1.2), which is not what any
// trigonometry function expects: the usual convention is radians, counter-clockwise, from 3
// o'clock. Whatever draws these has to turn one into the other, and a wrong turn is silent — the
// counters simply appear somewhere else on the orbit, with every constant here still correct.
// So: if a counter is ever in the wrong place, check that conversion before you doubt the angle.
// The same caution the swatch's `pxPerUserUnit` pin exists for (#278, #279): a constant is only
// as true as the transform between it and the screen, and that transform deserves its own test.

/** A lone ghost sits at 6 o'clock, away from the seat mark's anchor and the glint (docs/UI.md §9). */
export const LADDER_ORBIT_ANGLE_SINGLE_DEG = 180;

/**
 * The two endosymbiosis counters: aerobic lower-left, photosynthetic lower-right (docs/UI.md §9).
 * Keyed by the bacterium variant each counter tallies, so the record never carries a bare number.
 */
export const LADDER_ORBIT_ANGLES_PAIR_DEG = { aerobic: 225, photosynthetic: 135 } as const;
