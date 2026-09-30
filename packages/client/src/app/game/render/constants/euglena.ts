// The euglena's spindle, its leading flagellum and its eyespot (#194; docs/rendering/cells.md §2.4, docs/visual-style/
// motion-and-legibility.md §5.1, sheet 04 euglena). Sizes are fractions of the cell radius `r` unless the suffix says
// px or degrees.

// ---- the spindle body: `SPINDLE_ASPECT` long, blunt at the front where the flagellum leaves, pointed at the rear ----
/**
 * The spindle is a superellipse of the aspect whose exponent runs from the front's to the rear's with `cos Δ`: 2 (an
 * ellipse's round nose) at the front and 1.3 (a point) at the rear. No exponent passes 2, so the two tips are the
 * furthest points of the outline and `B`'s peak is exact.
 */
export const SPINDLE_FRONT_EXPONENT = 2;
export const SPINDLE_REAR_EXPONENT = 1.3;
/** The superellipse's axes never reach zero in the exponent's power and logarithm: the floor they are held at. */
export const SPINDLE_AXIS_FLOOR = 1e-6;

// ---- the leading flagellum: the euglena's appendage (§5.1), one thick whip out of the nose ----
/**
 * The whip's root sits this far inside the nose, so it leaves the body as one piece with it, and its tip this far past
 * the nose along the heading: sheet 04's 40 wu whip on a 50 wu spindle, a little shortened for the quad, 2.2 r past a
 * nose 1.85 r out puts the tip past 4 r, well over 1.9 r past the 1.3 r rings (§5.1 rule 1).
 */
export const EUGLENA_FLAGELLUM_ROOT_INSET_RADII = 0.2;
export const EUGLENA_FLAGELLUM_REACH_RADII = 2.2;
/**
 * A travelling wave runs from the root to the tip, `EUGLENA_FLAGELLUM_WAVES` along the whip, one wavelength per turn
 * of the cell's beat (`CILIA_BEAT_HZ` swimming, `CILIA_BEAT_IDLE_HZ` at rest); its sideways swing grows from nothing
 * at the root to the amplitude at the tip, so the whip leaves the nose straight and lashes at the end.
 */
export const EUGLENA_FLAGELLUM_AMPLITUDE_RADII = 0.4;
export const EUGLENA_FLAGELLUM_WAVES = 1.25;
/**
 * The whip tapers from its root to a round tip: 0.31 r wide at its neck, halfway along the part past the nose,
 * measured square across it (§5.1 rule 2).
 */
export const EUGLENA_FLAGELLUM_ROOT_WIDTH_RADII = 0.44;
export const EUGLENA_FLAGELLUM_TIP_WIDTH_RADII = 0.2;
/**
 * The whip is the cell's silhouette, so it wears the player's rim colour (§5.1 rule 6): denser down the middle than at
 * its edges, with a white highlight down its centre at full LOD.
 */
export const EUGLENA_FLAGELLUM_EDGE_ALPHA = 0.55;
export const EUGLENA_FLAGELLUM_CORE_ALPHA = 0.9;
export const EUGLENA_FLAGELLUM_HIGHLIGHT_ALPHA = 0.45;
/** The highlight's half-width as a share of the whip's. */
export const EUGLENA_FLAGELLUM_HIGHLIGHT_SHARE = 0.25;

// ---- the eyespot: the red dot at the front, the form's tell at every LOD down to the far dot ----
/**
 * Where it sits in the heading frame, before the pulse and the stretch: sheet 04 puts it 0.70 r toward the nose and
 * 0.17 r to one side; 0.8 r along keeps it clear of the nucleus at every tier.
 */
export const EYESPOT_ALONG_RADII = 0.8;
export const EYESPOT_ACROSS_RADII = 0.16;
/** Sheet 04's 2 wu dot is 0.14 r; exaggerated to read at play zoom. The halo reaches the second radius. */
export const EYESPOT_RADIUS_RADII = 0.15;
export const EYESPOT_HALO_RADII = 0.26;
export const EYESPOT_HALO_ALPHA = 0.4;
/** The halo's alpha gains this share per tier past the first (visual-style/cells-and-organelles.md §4: +0 / 25 / 50 %). */
export const EYESPOT_GLOW_PER_TIER = 0.25;
/** The `EYESPOT_RIM` ring round the dot, as a share of its radius. */
export const EYESPOT_RIM_SHARE = 0.22;
