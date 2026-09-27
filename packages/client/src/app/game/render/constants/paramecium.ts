// The paramecium's slipper and its cilia tufts (#193; docs/rendering/cells.md §2.4, docs/visual-style/
// motion-and-legibility.md §5.1, sheet 04 paramecium). Sizes are fractions of the cell radius `r` unless the suffix
// says px or degrees.

// ---- the slipper body: an ellipse of the tier's aspect, blunter at the front, notched by the oral groove ----
/** `B` gains `1 + SLIPPER_FRONT_BLUNTNESS · cos Δ`: the front end rounder and fuller than the rear (sheet 04). */
export const SLIPPER_FRONT_BLUNTNESS = 0.06;
/** The oral groove: a Gaussian notch this deep (a share of `B`), this far off the heading, this wide (σ). */
export const SLIPPER_ORAL_GROOVE_DEPTH = 0.14;
export const SLIPPER_ORAL_GROOVE_DEG = 43;
export const SLIPPER_ORAL_GROOVE_SIGMA_DEG = 12;

// ---- the cilia tufts: the paramecium's appendage (§5.1), a full fringe of bold tufts round the slipper ----
/** Tufts round the whole outline, spaced near-evenly along it rather than by angle from the centre, none on the axis. */
export const CILIA_TUFT_COUNT = 16;
/**
 * A tuft at full extension, in radii past the membrane, measured out from the centre: the slipper's narrow flank
 * sits 0.71 r out at tier III, so its tufts reach 2.0 r there, 0.7 r past the 1.3 r rings, and still 1.93 r when
 * the breath, the wobble and the rest lobes all pull that flank in at once (§5.1 rule 1).
 */
export const CILIA_TUFT_REACH_RADII = 1.3;
/**
 * A tuft beats between this share of its reach and all of it: 0.86 r, so the flank's tuft still reaches 1.57 r, and
 * 1.49 r with the flank pulled in (§5.1's 1.45 r).
 */
export const CILIA_TUFT_RETRACTED_SHARE = 0.66;
/**
 * A tuft tapers from its root to its tip, capped by a half-disc of the tip's width: 0.33 r wide at its neck, halfway
 * out, measured square across the bent tuft (§5.1 rule 2), so the roots merge into one full fringe along the flanks
 * while the tips stand apart as brushes.
 */
export const CILIA_TUFT_ROOT_WIDTH_RADII = 0.4;
export const CILIA_TUFT_TIP_WIDTH_RADII = 0.26;
/**
 * The metachronal wave: the tufts beat front to rear down both flanks, this many waves on each, one beat per turn of
 * the cilia phase (`CILIA_BEAT_HZ` swimming, `CILIA_BEAT_IDLE_HZ` at rest), so the fringe ripples backward.
 */
export const CILIA_TUFT_WAVES_PER_FLANK = 2;
/**
 * Each tuft leaves the membrane square and bends back toward the tail, its tip swept by this lean (plus the speed's,
 * at top speed), ± the beat's swing. The flank's tufts lean fully; toward the nose and the tail the lean fades by
 * `CILIA_TUFT_SIDE_GAIN · sin φ`, so the two tufts beside the nose part like a bow wave.
 */
export const CILIA_TUFT_LEAN_DEG = 24;
export const CILIA_TUFT_SPEED_LEAN_DEG = 16;
export const CILIA_TUFT_BEAT_SWING_DEG = 12;
export const CILIA_TUFT_SIDE_GAIN = 2;
/** A `CILIA` wash, deepest down the tuft's middle, with fine bright strands in it; at mid LOD only the wash. */
export const CILIA_TUFT_WASH_CORE_ALPHA = 0.5;
export const CILIA_TUFT_WASH_EDGE_ALPHA = 0.12;
export const CILIA_TUFT_STRAND_ALPHA = 0.75;
export const CILIA_TUFT_STRANDS = 3;
export const CILIA_TUFT_STRAND_WIDTH_PX = 1;
/** The tip fades to this share of its alpha over the tuft's outer part, so it reads as a brush, not a blade. */
export const CILIA_TUFT_TIP_ALPHA_SHARE = 0.55;
