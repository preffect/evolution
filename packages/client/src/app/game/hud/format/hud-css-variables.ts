// The one bridge between the HUD's constant homes and its stylesheets (docs/CODE-STANDARDS.md §2).
//
// Angular resolves component styles at build time, so a stylesheet cannot interpolate a TypeScript
// constant. Rather than copy the numbers into CSS — two homes for one fact, the review reject —
// the shell publishes them as custom properties on its host and every stylesheet reads
// `var(--hud-…)`. This function is that list, pure and unit-tested **entry by entry**: the spec
// asserts the map's keys are exactly this set, so a hand-typed value cannot join it unnoticed.
// Enforcement is the only reason the indirection exists, so nothing here may go unpinned, and
// nothing may be published that no stylesheet reads.
//
// Lengths are emitted with their unit and are at HUD scale 1; a stylesheet scales one with
// `calc(var(--hud-…) * var(--hud-scale))`, so hit-testing stays in real pixels (docs/ui/layout.md §1).

import {
  CALLOUT_BACKING,
  DANGER,
  DNA_RING_STROKE_PX,
  LEVEL_GOLD,
  OUTLINE,
  PANEL_BOTTOM,
  PANEL_RIM,
  PANEL_TOP,
  TEXT,
  TEXT_LABEL,
  TEXT_MUTED,
  UI_LABEL_TRACKING_EM,
  UI_TYPE,
  WHITE,
} from '../../render/constants';
import {
  CONNECTION_LOST_DIM_ALPHA,
  HUD_MARGIN_PX,
  NOTICE_GAP_PX,
  NOTICE_PADDING_INLINE_PX,
  NOTICE_RIM_PX,
  NOTICE_ROW_HEIGHT_PX,
  NOTICE_STACK_MAX_Y_PX,
  LEADERBOARD_COLUMN_GAP_PX,
  LEADERBOARD_CORNER_RADIUS_PX,
  LEADERBOARD_EXPAND_MS,
  LEADERBOARD_FULL_WIDTH_PX,
  LEADERBOARD_HEADER_HEIGHT_PX,
  LEADERBOARD_LABEL_ROW_HEIGHT_PX,
  LEADERBOARD_LEVEL_COLUMN_PX,
  LEADERBOARD_NUMBER_COLUMN_PX,
  LEADERBOARD_PADDING_PX,
  LEADERBOARD_RANK_COLUMN_PX,
  LEADERBOARD_ROW_HEIGHT_PX,
  LEADERBOARD_ROW_SLIDE_MS,
  LEADERBOARD_SWATCH_COLUMN_PX,
  LEADERBOARD_SWATCH_DIAMETER_PX,
  LEADERBOARD_WIDTH_PX,
  HUD_FOCUS_RING_PX,
  PICKER_CARD_CONTENT_GAP_PX,
  PICKER_CARD_GLOW_PX,
  PICKER_CARD_HIGHLIGHT_MS,
  PICKER_CARD_PADDING_BLOCK_PX,
  PICKER_CARD_PADDING_INLINE_PX,
  PICKER_DIM_SOFT_EDGE_FRACTION,
  PICKER_RIBBON_PADDING_INLINE_PX,
  PICKER_CARD_GAP_PX,
  PICKER_CARD_HEIGHT_PX,
  PICKER_CARD_LIFT_PX,
  PICKER_CARD_MEDALLION_PX,
  PICKER_CARD_WIDTH_PX,
  PICKER_DIM_ALPHA,
  PICKER_BAND_GAP_PX,
  PICKER_ROW_GAP_PX,
  PICKER_TIMER_BAR_WIDTH_PX,
  HUD_PLAYER_EXCLUSION_PX,
  ROUND_CLOCK_PULSE_PERIOD_MS,
} from '../hud-constants';

/** The custom property `hud.component.ts` sets from the live box; every length multiplies by it. */
export const HUD_SCALE_VARIABLE = '--hud-scale';

type StyleVariables = Readonly<Record<string, string>>;

/** Layout frame (docs/ui/layout.md §1) and the chrome's sizes (docs/ui/hud.md §3.1.1). */
function chromeVariables(): StyleVariables {
  return {
    '--hud-margin': `${HUD_MARGIN_PX}px`,
    '--hud-leaderboard-width': `${LEADERBOARD_WIDTH_PX}px`,
    '--hud-leaderboard-full-width': `${LEADERBOARD_FULL_WIDTH_PX}px`,
    '--hud-leaderboard-header-height': `${LEADERBOARD_HEADER_HEIGHT_PX}px`,
    '--hud-leaderboard-row-height': `${LEADERBOARD_ROW_HEIGHT_PX}px`,
    '--hud-leaderboard-label-row-height': `${LEADERBOARD_LABEL_ROW_HEIGHT_PX}px`,
    '--hud-leaderboard-swatch-size': `${LEADERBOARD_SWATCH_DIAMETER_PX}px`,
    '--hud-leaderboard-padding': `${LEADERBOARD_PADDING_PX}px`,
    '--hud-leaderboard-corner-radius': `${LEADERBOARD_CORNER_RADIUS_PX}px`,

    // The row and label-strip column tracks (§3.1.1): fixed, so the two grids resolve identically.
    '--hud-leaderboard-rank-column': `${LEADERBOARD_RANK_COLUMN_PX}px`,
    '--hud-leaderboard-swatch-column': `${LEADERBOARD_SWATCH_COLUMN_PX}px`,
    '--hud-leaderboard-level-column': `${LEADERBOARD_LEVEL_COLUMN_PX}px`,
    '--hud-leaderboard-number-column': `${LEADERBOARD_NUMBER_COLUMN_PX}px`,
    '--hud-leaderboard-column-gap': `${LEADERBOARD_COLUMN_GAP_PX}px`,

    '--hud-row-slide-duration': `${LEADERBOARD_ROW_SLIDE_MS}ms`,
    '--hud-leaderboard-expand-duration': `${LEADERBOARD_EXPAND_MS}ms`,
    '--hud-clock-pulse-duration': `${ROUND_CLOCK_PULSE_PERIOD_MS}ms`,

    // Every control's focus ring (docs/ui/input-and-onboarding.md §4).
    '--hud-focus-ring': `${HUD_FOCUS_RING_PX}px`,
  };
}

/** The trait picker (docs/ui/overlays.md §3.2): the band hangs from the exclusion box, never an absolute y. */
function pickerVariables(): StyleVariables {
  return {
    '--hud-exclusion': `${HUD_PLAYER_EXCLUSION_PX}px`,
    '--hud-picker-band-gap': `${PICKER_BAND_GAP_PX}px`,
    '--hud-picker-row-gap': `${PICKER_ROW_GAP_PX}px`,
    '--hud-picker-timer-width': `${PICKER_TIMER_BAR_WIDTH_PX}px`,
    '--hud-picker-card-width': `${PICKER_CARD_WIDTH_PX}px`,
    '--hud-picker-card-height': `${PICKER_CARD_HEIGHT_PX}px`,
    '--hud-picker-card-gap': `${PICKER_CARD_GAP_PX}px`,
    '--hud-picker-medallion': `${PICKER_CARD_MEDALLION_PX}px`,
    '--hud-picker-card-lift': `${PICKER_CARD_LIFT_PX}px`,
    '--hud-picker-timer-height': `${DNA_RING_STROKE_PX}px`,
    '--hud-picker-dim-alpha': String(PICKER_DIM_ALPHA),
    '--hud-picker-dim-soft-edge': String(PICKER_DIM_SOFT_EDGE_FRACTION),
    '--hud-picker-card-content-gap': `${PICKER_CARD_CONTENT_GAP_PX}px`,
    '--hud-picker-card-padding-block': `${PICKER_CARD_PADDING_BLOCK_PX}px`,
    '--hud-picker-card-padding-inline': `${PICKER_CARD_PADDING_INLINE_PX}px`,
    '--hud-picker-card-glow': `${PICKER_CARD_GLOW_PX}px`,
    '--hud-picker-highlight-duration': `${PICKER_CARD_HIGHLIGHT_MS}ms`,
    '--hud-picker-ribbon-padding-inline': `${PICKER_RIBBON_PADDING_INLINE_PX}px`,
  };
}

/** The notices along the top edge (docs/ui/overlays.md §3.6): the connection banner and the server-error line. */
function noticeVariables(): StyleVariables {
  return {
    '--hud-notice-row-height': `${NOTICE_ROW_HEIGHT_PX}px`,
    '--hud-notice-stack-max-y': `${NOTICE_STACK_MAX_Y_PX}px`,
    '--hud-notice-padding-inline': `${NOTICE_PADDING_INLINE_PX}px`,
    '--hud-notice-gap': `${NOTICE_GAP_PX}px`,
    '--hud-notice-rim': `${NOTICE_RIM_PX}px`,
    '--hud-connection-lost-dim-alpha': String(CONNECTION_LOST_DIM_ALPHA),
    '--hud-danger': DANGER,
    '--hud-callout-backing': CALLOUT_BACKING,
  };
}

/**
 * Type roles, each published whole — a size with its own face — and the colour roles
 * (docs/visual-style/principles-and-palette.md §2, docs/visual-style/ui-type.md §7).
 */
function typeAndColourVariables(): StyleVariables {
  return {
    '--hud-font-sans': UI_TYPE.body.font,
    '--hud-font-mono': UI_TYPE.clock.font,
    '--hud-font-figure': UI_TYPE.figure.font,
    '--hud-type-clock': `${UI_TYPE.clock.px}px`,
    '--hud-type-body': `${UI_TYPE.body.px}px`,
    '--hud-type-figure': `${UI_TYPE.figure.px}px`,
    '--hud-type-caption': `${UI_TYPE.caption.px}px`,
    '--hud-type-title': `${UI_TYPE.title.px}px`,
    '--hud-type-value': `${UI_TYPE.value.px}px`,
    '--hud-type-card-name': `${UI_TYPE.cardName.px}px`,
    '--hud-type-label': `${UI_TYPE.label.px}px`,
    '--hud-label-tracking': `${UI_LABEL_TRACKING_EM}em`,

    '--hud-text': TEXT,
    '--hud-text-label': TEXT_LABEL,
    '--hud-text-muted': TEXT_MUTED,
    '--hud-panel-top': PANEL_TOP,
    '--hud-panel-bottom': PANEL_BOTTOM,
    '--hud-panel-rim': PANEL_RIM,
    '--hud-level-gold': LEVEL_GOLD,
    '--hud-outline': OUTLINE,
    '--hud-white': WHITE,
  };
}

/**
 * The custom property the shell sets from the live notice count (docs/ui/overlays.md §3.6): like the scale
 * it is state, not a constant, so it is published beside the map rather than inside it.
 */
export const HUD_NOTICE_ROWS_VARIABLE = '--hud-notice-rows';

/** The notice rows up along the top edge, unitless, so a top-anchored length can multiply by it. */
export function noticeRowsVariable(noticeRows: number): StyleVariables {
  return { [HUD_NOTICE_ROWS_VARIABLE]: String(noticeRows) };
}

/** Every `--hud-…` a HUD stylesheet may read, by name, at scale 1. */
export function hudStyleVariables(hudScale: number): StyleVariables {
  return {
    [HUD_SCALE_VARIABLE]: String(hudScale),
    ...chromeVariables(),
    ...pickerVariables(),
    ...noticeVariables(),
    ...typeAndColourVariables(),
  };
}
