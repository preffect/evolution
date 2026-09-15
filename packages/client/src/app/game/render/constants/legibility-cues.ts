// The legibility cues' constants (docs/ui/hud.md §3.1.6, decision #324): the table there owns every value and its
// rationale; the home is `render/constants.ts` because the renderer applies them. The rows marked **state** in that
// table live in `state/legibility-constants.ts`. `render/legibility-cues-ledger.spec.ts` parses the table and pins
// every row by name and value. Every px value is a screen px size: nothing here scales with `--hud-scale`.

// ---- the cue pill ----
export const CUE_PILL_HEIGHT_PX = 28;
export const CUE_PILL_PAD_PX = 12;
export const CUE_RIM_PX = 2;
export const CUE_GAP_PX = 6;
export const CUE_ROW_GAP_PX = 4;
export const CUE_SEGMENT_GAP_PX = 6;
export const TREND_GLYPH_PX = 10;

// ---- the rate tags ----
export const RATE_TAG_ROWS_MAX = 3;
export const RATE_TAG_MIN_MASS_PER_SECOND = 0.1;
export const RATE_TAG_REFRESH_MS = 500;

// ---- the floaters ----
export const FLOATER_RISE_PX = 24;
export const FLOATER_LIFETIME_MS = 1200;
export const FLOATER_FADE_FRACTION = 0.3;
export const FLOATER_MERGE_MS = 300;
export const FLOATER_MAX_VISIBLE = 4;

// ---- the zone pill ----
export const ZONE_PILL_SECONDS = 4;
export const ZONE_PILL_COOLDOWN_SECONDS = 20;
export const ZONE_PILL_DOT_PX = 8;

// ---- the relation rings (drawn by #385's relation-ring slice) ----
export const RELATION_RING_RADII = 1.3;
export const RELATION_RING_MIN_GAP_PX = 6;
export const RELATION_RING_STROKE_PX = 1.5;
export const TOXIC_RING_LINE_GAP_PX = 2;
export const EDIBLE_RING_ALPHA = 0.6;
export const TOXIC_RING_ALPHA = 0.9;
