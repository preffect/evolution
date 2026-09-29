// The diatom's silica valve and its spines (#195; docs/rendering/cells.md §2.4, docs/visual-style/motion-and-legibility.md
// §5.1, sheet 04 diatom). Sizes are fractions of the cell radius `r` unless the suffix says px.

// ---- the valve: sheet 04's 36 striae, the pores along every other one and the girdle at the margin ----
/**
 * The valve's striae alternate: every other one is a bold rib, the ones between are fine and carry the pores. They run
 * radially from the central area to just inside the margin, in the body frame turned with the heading, so the shell
 * turns as one piece when the cell does.
 */
export const DIATOM_STRIA_COUNT = 36;
export const DIATOM_STRIA_INNER_RADII = 0.28;
export const DIATOM_STRIA_OUTER_RADII = 0.9;
/** Sheet 04's 1.4 / 0.8 px strokes at 3 px / wu, a little bolder so they read at play zoom. */
export const DIATOM_RIB_WIDTH_PX = 1.6;
export const DIATOM_RIB_ALPHA = 0.55;
export const DIATOM_FINE_STRIA_WIDTH_PX = 1;
export const DIATOM_FINE_STRIA_ALPHA = 0.3;
/** Where the striae start and stop, feathered this far so their ends are crisp but not aliased. */
export const DIATOM_STRIA_END_FEATHER_RADII = 0.02;
/** Sheet 04's pore rows on each fine stria: five, the first `FIRST` out and `SPACING` apart. */
export const DIATOM_PORE_ROWS = 5;
export const DIATOM_PORE_FIRST_RADII = 0.36;
export const DIATOM_PORE_SPACING_RADII = 0.12;
/** A pore's radius, floored so it stays a dot on a small cell. */
export const DIATOM_PORE_RADIUS_RADII = 0.022;
export const DIATOM_PORE_MIN_PX = 1;
export const DIATOM_PORE_ALPHA = 0.6;
/**
 * The girdle: sheet 04's two concentric lines inside the margin, a `SILICA_BASE` line and a `SILICA_LIGHT` one nearer
 * the membrane, which make the outline read as a hard glass rim rather than a film.
 */
export const DIATOM_GIRDLE_INNER_RADII = 0.86;
export const DIATOM_GIRDLE_INNER_WIDTH_PX = 1.5;
export const DIATOM_GIRDLE_INNER_ALPHA = 0.6;
export const DIATOM_GIRDLE_OUTER_RADII = 0.94;
export const DIATOM_GIRDLE_OUTER_WIDTH_PX = 1.2;
export const DIATOM_GIRDLE_OUTER_ALPHA = 0.7;

// ---- the spines: the diatom's appendage (§5.1), radial spikes round the whole valve, a bright tip on each ----
/** Spines per tier (visual-style/cells-and-organelles.md §4): the star gains points as the shell hardens. */
export const DIATOM_SPINE_COUNT_BY_TIER = [8, 12, 16] as const;
/**
 * Each spine is rooted this far inside the membrane, so it leaves the valve as one piece with it, and reaches this far
 * past it: its tip sits 2 r out, 0.7 r past the 1.3 r rings (§5.1 rule 1). Spines never retract.
 */
export const DIATOM_SPINE_ROOT_INSET_RADII = 0.1;
export const DIATOM_SPINE_REACH_RADII = 1;
/**
 * A straight taper from the root to a round tip: 0.31 r wide at its neck, halfway along the part past the membrane
 * (§5.1 rule 2). At tier III the sixteen roots meet just outside the membrane, a collar the points rise from.
 */
export const DIATOM_SPINE_ROOT_WIDTH_RADII = 0.44;
export const DIATOM_SPINE_TIP_WIDTH_RADII = 0.2;
/** The spines are the cell's silhouette, so they wear the player's rim colour (§5.1 rule 6), denser down the middle. */
export const DIATOM_SPINE_EDGE_ALPHA = 0.6;
export const DIATOM_SPINE_CORE_ALPHA = 0.95;
/** A glassy `SILICA_LIGHT` highlight down each spine's centre at full LOD, as a share of its half-width. */
export const DIATOM_SPINE_HIGHLIGHT_ALPHA = 0.5;
export const DIATOM_SPINE_HIGHLIGHT_SHARE = 0.3;
/** The bright tip: a white dot the tip's width across, in a glow to the second radius. */
export const DIATOM_SPINE_TIP_DOT_ALPHA = 0.95;
export const DIATOM_SPINE_TIP_GLOW_RADII = 0.2;
export const DIATOM_SPINE_TIP_GLOW_ALPHA = 0.45;
