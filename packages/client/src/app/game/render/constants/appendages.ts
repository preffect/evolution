// The appendage rule every form follows (docs/visual-style/motion-and-legibility.md §5.1, #646): arms, spines,
// stalks and tufts are exaggerated well past the 1.3 r rings so the player sees them at normal zoom. Sizes are
// fractions of the cell radius `r`.

/**
 * Rule 1: an appendage's tip reaches at least this far past `ENGULF_WARNING_RING_RADII` at full extension, and never
 * retracts to less than the second past it.
 */
export const APPENDAGE_MIN_REACH_PAST_RING_RADII = 0.6;
export const APPENDAGE_MIN_RETRACTED_PAST_RING_RADII = 0.15;
/**
 * Never a hairline (§5.1 rule 2): an appendage's width at its neck, halfway out along it (where it has left the body,
 * at half its height), is at least this many radii, whatever its extension.
 */
export const APPENDAGE_MIN_NECK_WIDTH_RADII = 0.3;
/**
 * Rule 4 (#730): the rings trace the outline. A ring lobe is a membrane bump at its full height with its σ widened to
 * `√(σ² + RING_TRACE_SIGMA_WIDENING · ln(1 + g))`, `g` the ring's gap over the core radius under the bump: fitted so
 * the ring clears the arm's flanks by the gap as well as its tip (`traced-ring.spec.ts` measures the clearance).
 */
export const RING_TRACE_SIGMA_WIDENING = 0.21;
/** The dash runs along the traced ring: its extra arc length is integrated in this many trapezoids round the turn. */
export const RING_TRACE_ARC_SAMPLES = 96;
/** …or this many when the ring has no lobe and only the body shapes it: a smooth curve, a coarser grid is enough. */
export const RING_TRACE_BODY_ARC_SAMPLES = 48;
/** Angles the ring's body offset is sampled at for its reach bound, round the turn. */
export const RING_TRACE_REACH_SAMPLES = 360;
/** What the sampled body bound adds for the peaks between its samples, as a share. */
export const RING_TRACE_REACH_MARGIN = 0.01;
