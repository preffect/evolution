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
