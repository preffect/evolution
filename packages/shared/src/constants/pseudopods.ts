// The amoeba's arms (docs/ecology/absorption.md §6.1 "the arm grab", docs/visual-style/motion-and-legibility.md §5.1,
// #735): how far a pseudopod reaches past the round core, in core radii. The renderer draws the arms from these and
// the server's engulf start reads the grab reach derived from them, so the arm the player sees and the arm that grabs
// are one length. The arms' angles stay the renderer's (they run on its clock), so the grab is direction-free.

/** A lobe at full extension: the tip at 1.95 r, 0.65 r past the 1.3 r rings. */
export const PSEUDOPOD_REACH = 0.95;
/** A lobe extends and retracts on a sine between this share of its reach and all of it. */
export const PSEUDOPOD_RETRACTED_SHARE = 0.65;
/**
 * The arm grab (#735): an arm reaches at least this far past the body at every moment of its cycle, `PSEUDOPOD_REACH ×
 * PSEUDOPOD_RETRACTED_SHARE` (pinned by `pseudopods.test.ts`; written out so the tier tables and the docs read the same
 * 0.6175 rather than the product's last-bit rounding), so an amoeba's engulf start reaches this many of its own radii
 * further than the body (`armGrabReachRadii`, every tier).
 */
export const AMOEBA_ARM_GRAB_REACH_RADII = 0.6175;
