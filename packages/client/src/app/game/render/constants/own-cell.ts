// The own-cell indicators' constants (docs/UI.md §9, whose table owns every value and whose
// rationale column says why each one is what it is; the home is `render/constants.ts` because the
// renderer applies them). `render/constants-ledger.spec.ts` parses that table and pins every row
// here by name and value. `DNA_RING_KEEP_OUT_FRACTION` is §9's too, but its page is `organelles.ts`
// beside the slot rules that read it. Every px value is a screen px floor (UI.md §3.1.3): nothing
// here scales with the camera or with `--hud-scale`.

// ---- the DNA ring and the level numeral ----
export const DNA_RING_RADIUS_FRACTION = 0.44;
export const DNA_RING_MIN_RADIUS_PX = 17;
export const DNA_RING_STROKE_PX = 4;
export const DNA_RING_TRACK_PAD_PX = 1;
export const DNA_RING_TRACK_ALPHA = 0.35;
export const DNA_RING_KEEP_OUT_PAD_PX = 1;
export const LEVEL_NUMERAL_OUTLINE_PX = 2;
export const LEVEL_NUMERAL_OUTLINE_ALPHA = 0.7;

// ---- the sprint state of the self ring ----
export const SELF_RING_TRACK_ALPHA = 0.18;

// ---- the ladder orbit ----
export const LADDER_ORBIT_GAP_PX = 12;
export const LADDER_SEAT_MARK_CLEARANCE_PX = 1;
export const LADDER_GHOST_PX = 14;
export const LADDER_PIP_PX = 4;
export const LADDER_PIP_GAP_PX = 3;
export const LADDER_PIP_ROW_MAX = 5;
export const LADDER_PIP_STROKE_PX = 1;
export const LADDER_PIP_LIT_ALPHA = 0.95;
export const LADDER_PIP_UNLIT_ALPHA = 0.7;
export const LADDER_ITEM_GAP_PX = 4;
/**
 * A rung ghost to a counter sharing the orbit (#285 B): the counter turns away until the drawn boxes
 * (the ghost's square, the counter's ghost and pip block, each laid tangent) are this far apart.
 */
export const LADDER_ITEM_CLEARANCE_PX = 4;
export const LADDER_BACKING_PX = 16;
export const LADDER_BACKING_END_PAD_PX = 4;
export const LADDER_BACKING_ALPHA = 0.45;
export const LADDER_UNLOCK_RING_PAD_PX = 2;
export const LADDER_UNLOCK_RING_STROKE_PX = 1.5;

// The orbit angles are **degrees, clockwise from 12 o'clock** (docs/UI.md §3.1.2), which is not
// what a trigonometry function expects. `effects/own-cell-indicators.ts` `screenRadiansOf` is the
// one turn between the two, and its spec pins where each of these angles lands on screen: a wrong
// turn is silent, the counters simply appear elsewhere with every constant here still correct.

/** A lone ghost sits at 6 o'clock, away from the seat mark's anchor and the glint. */
export const LADDER_ORBIT_ANGLE_SINGLE_DEG = 180;

/**
 * The two endosymbiosis counters: aerobic lower-left, photosynthetic lower-right. Keyed by the
 * bacterium variant each counter tallies, so the record never carries a bare number.
 */
export const LADDER_ORBIT_ANGLES_PAIR_DEG = { aerobic: 225, photosynthetic: 135 } as const;

// ---- the escape arc and the world-anchored labels ----
export const ESCAPE_ARC_STROKE_PX = 4;
export const ESCAPE_ARC_TRACK_ALPHA = 0.2;
export const THREAT_LABEL_GAP_PX = 6;
export const LABEL_PILL_HEIGHT_PX = 18;
export const LABEL_PILL_PAD_PX = 8;
export const LABEL_PILL_ALPHA = 0.75;
export const DANGER_LABEL_RIM_PX = 1;

/** The DNA ring's fill tween: a rate, not a clip, since it has no keyframes. */
export const INDICATOR_FILL_TWEEN_MS = 200;
