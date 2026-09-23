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
// Only the HUD's own sizes are here. The type roles, the colour roles, the focus ring and the scale are the UI kit's
// (`ui-kit/format/ui-css-variables.ts`, docs/ui/components-and-constants.md §10.1), published on the same shell, so
// a HUD stylesheet reads `--ui-type-…`, the `--ui-` colours and `--ui-scale` (#381). Lengths are emitted with their
// unit at scale 1; a stylesheet scales one with `calc(var(--hud-…) * var(--ui-scale))`, so hit-testing stays in real
// pixels (docs/ui/layout.md §1).

import { DNA_RING_STROKE_PX, GAIN, OUTLINE, TREND_GLYPH_PX } from '../../render/constants';
import {
  AFFECTING_MASS_ROW_GAP_PX,
  AFFECTING_SPARKLINE_HEIGHT_PX,
  AFFECTING_SPARKLINE_STROKE_PX,
  AFFECTING_SPARKLINE_WIDTH_PX,
  CONNECTION_LOST_DIM_ALPHA,
  HINT_RIM_PX,
  HUD_MARGIN_PX,
  NOTICE_GAP_PX,
  NOTICE_PADDING_INLINE_PX,
  NOTICE_RIM_PX,
  NOTICE_ROW_HEIGHT_PX,
  NOTICE_STACK_MAX_Y_PX,
  LEADERBOARD_COLUMN_GAP_PX,
  LEADERBOARD_CORNER_RADIUS_PX,
  LEADERBOARD_ENGULFS_COLUMN_PX,
  LEADERBOARD_EXPAND_MS,
  LEADERBOARD_FOOTER_ROW_HEIGHT_PX,
  LEADERBOARD_FULL_WIDTH_PX,
  LEADERBOARD_HEADER_HEIGHT_PX,
  LEADERBOARD_LABEL_ROW_HEIGHT_PX,
  LEADERBOARD_LEVEL_COLUMN_PX,
  LEADERBOARD_MASS_COLUMN_PX,
  LEADERBOARD_PADDING_PX,
  LEADERBOARD_RANK_COLUMN_PX,
  LEADERBOARD_ROW_HEIGHT_PX,
  LEADERBOARD_RIM_PX,
  LEADERBOARD_ROW_SLIDE_MS,
  LEADERBOARD_SCORE_COLUMN_PX,
  LEADERBOARD_SWATCH_COLUMN_PX,
  LEADERBOARD_SWATCH_DIAMETER_PX,
  LEADERBOARD_WIDTH_PX,
  MENU_PANEL_WIDTH_PX,
  MENU_TRAIT_LINE_HEIGHT_PX,
  MENU_TRAIT_ROW_HEIGHT_PX,
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
  PICKER_ROW_GAP_PX,
  PICKER_TIMER_BAR_WIDTH_PX,
  ROUND_CLOCK_PULSE_PERIOD_MS,
} from '../hud-constants';
import { TRAIT_GLYPH_LIST_PX } from '../../glyphs/glyph-constants';
import type { ViewportPx } from '../../render/camera';
import { pickerBandOffsetPx, pickerSpotlightRadiusPx } from './picker-band';

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
    '--hud-leaderboard-footer-row-height': `${LEADERBOARD_FOOTER_ROW_HEIGHT_PX}px`,
    '--hud-leaderboard-swatch-size': `${LEADERBOARD_SWATCH_DIAMETER_PX}px`,
    '--hud-leaderboard-padding': `${LEADERBOARD_PADDING_PX}px`,
    '--hud-leaderboard-corner-radius': `${LEADERBOARD_CORNER_RADIUS_PX}px`,
    '--hud-leaderboard-rim': `${LEADERBOARD_RIM_PX}px`,

    // The row and label-strip column tracks (§3.1.1): fixed, so the two grids resolve identically.
    '--hud-leaderboard-rank-column': `${LEADERBOARD_RANK_COLUMN_PX}px`,
    '--hud-leaderboard-swatch-column': `${LEADERBOARD_SWATCH_COLUMN_PX}px`,
    '--hud-leaderboard-level-column': `${LEADERBOARD_LEVEL_COLUMN_PX}px`,
    '--hud-leaderboard-score-column': `${LEADERBOARD_SCORE_COLUMN_PX}px`,
    '--hud-leaderboard-mass-column': `${LEADERBOARD_MASS_COLUMN_PX}px`,
    '--hud-leaderboard-engulfs-column': `${LEADERBOARD_ENGULFS_COLUMN_PX}px`,
    '--hud-leaderboard-column-gap': `${LEADERBOARD_COLUMN_GAP_PX}px`,

    '--hud-row-slide-duration': `${LEADERBOARD_ROW_SLIDE_MS}ms`,
    '--hud-leaderboard-expand-duration': `${LEADERBOARD_EXPAND_MS}ms`,
    '--hud-clock-pulse-duration': `${ROUND_CLOCK_PULSE_PERIOD_MS}ms`,
  };
}

/** The trait picker (docs/ui/overlays.md §3.2); where its band and dim disc sit is `pickerBandVariables`'s. */
function pickerVariables(): StyleVariables {
  return {
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

/**
 * The hold-Tab "affecting you" panel (docs/ui/overlays.md §3.7). Only the mass element's own sizes are here: the
 * panel's surface, padding, rim, radius, rows and headings are the kit's and arrive as `--ui-…`.
 */
function affectingPanelVariables(): StyleVariables {
  return {
    '--hud-affecting-mass-row-gap': `${AFFECTING_MASS_ROW_GAP_PX}px`,
    '--hud-affecting-sparkline-width': `${AFFECTING_SPARKLINE_WIDTH_PX}px`,
    '--hud-affecting-sparkline-height': `${AFFECTING_SPARKLINE_HEIGHT_PX}px`,
    '--hud-affecting-sparkline-stroke': `${AFFECTING_SPARKLINE_STROKE_PX}px`,
    '--hud-affecting-trend-glyph': `${TREND_GLYPH_PX}px`,
    // `TraitGlyphComponent` fills its host and leaves the sizing to the caller, so a trait row's marker has to be
    // given a box here or it resolves to 0 x 0 inside the kit's shrink-to-content marker cell and draws nothing.
    '--hud-affecting-trait-glyph': `${TRAIT_GLYPH_LIST_PX}px`,
  };
}

/**
 * The Escape menu (docs/ui/overlays.md §3.5): the panel and the `Your traits` rows. How many rows show before the list
 * scrolls is not published: `MENU_TRAITS_VISIBLE_ROWS` is a row count the component measures with, never a length.
 */
function menuVariables(): StyleVariables {
  return {
    '--hud-menu-panel-width': `${MENU_PANEL_WIDTH_PX}px`,
    '--hud-menu-trait-row-height': `${MENU_TRAIT_ROW_HEIGHT_PX}px`,
    '--hud-menu-trait-line-height': `${MENU_TRAIT_LINE_HEIGHT_PX}px`,
    '--hud-menu-trait-glyph': `${TRAIT_GLYPH_LIST_PX}px`,
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
    // The hint pill shares the notice row's surface (docs/ui/input-and-onboarding.md §5); a coach beat adds this rim.
    '--hud-hint-rim': `${HINT_RIM_PX}px`,
  };
}

/**
 * The two colour roles the kit does not carry (docs/visual-style/principles-and-palette.md §2): the text outline the
 * clock and the cues sit on, and the gain role the mass trend rises in (§3.7). Every other colour is the kit's.
 */
function hudColourVariables(): StyleVariables {
  return {
    '--hud-outline': OUTLINE,
    '--hud-gain': GAIN,
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

export const HUD_PICKER_BAND_OFFSET_VARIABLE = '--hud-picker-band-offset';
export const HUD_PICKER_SPOTLIGHT_VARIABLE = '--hud-picker-spotlight';

/**
 * The picker band's offset below the centre and the dim's clear radius for this viewport (docs/ui/overlays.md §3.2),
 * in real px: they already carry the scale, because under Z1 the cap orbit they clear follows the viewport's height.
 */
export function pickerBandVariables(viewport: ViewportPx): StyleVariables {
  return {
    [HUD_PICKER_BAND_OFFSET_VARIABLE]: `${pickerBandOffsetPx(viewport)}px`,
    [HUD_PICKER_SPOTLIGHT_VARIABLE]: `${pickerSpotlightRadiusPx(viewport)}px`,
  };
}

/** Every `--hud-…` a HUD stylesheet may read, by name, at scale 1. */
export function hudStyleVariables(): StyleVariables {
  return {
    ...chromeVariables(),
    ...pickerVariables(),
    ...affectingPanelVariables(),
    ...menuVariables(),
    ...noticeVariables(),
    ...hudColourVariables(),
  };
}
