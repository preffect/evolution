// The own-cell indicators' constants (docs/UI.md §9, whose table owns every value; the home is
// `render/constants.ts` because the renderer applies them). Only the rows the derived record needs
// are here — the orbit angles, which `ownCellIndicatorsFor` puts on each ladder counter. The
// geometry rows (radii, strokes, pip sizes, alphas) arrive with the drawing side, #187.

/** A lone ghost sits at 6 o'clock, away from the seat mark's anchor and the glint (docs/UI.md §9). */
export const LADDER_ORBIT_ANGLE_SINGLE_DEG = 180;

/**
 * The two endosymbiosis counters: aerobic lower-left, photosynthetic lower-right (docs/UI.md §9).
 * Keyed by the bacterium variant each counter tallies, so the record never carries a bare number.
 */
export const LADDER_ORBIT_ANGLES_PAIR_DEG = { aerobic: 225, photosynthetic: 135 } as const;
