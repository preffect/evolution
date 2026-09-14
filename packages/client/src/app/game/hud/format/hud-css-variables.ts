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
  HUD_MARGIN_PX,
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
  ROUND_CLOCK_PULSE_PERIOD_MS,
} from '../hud-constants';

/** The custom property `hud.component.ts` sets from the live box; every length multiplies by it. */
export const HUD_SCALE_VARIABLE = '--hud-scale';

/** Every `--hud-…` a HUD stylesheet may read, by name, at scale 1. */
export function hudStyleVariables(hudScale: number): Readonly<Record<string, string>> {
  return {
    [HUD_SCALE_VARIABLE]: String(hudScale),

    // Layout frame (docs/ui/layout.md §1) and the chrome's sizes (§3.1.1).
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

    // Type roles, each published whole — a size with its own face (docs/VISUAL-STYLE.md §7).
    '--hud-font-sans': UI_TYPE.body.font,
    '--hud-font-mono': UI_TYPE.clock.font,
    '--hud-font-figure': UI_TYPE.figure.font,
    '--hud-type-clock': `${UI_TYPE.clock.px}px`,
    '--hud-type-body': `${UI_TYPE.body.px}px`,
    '--hud-type-figure': `${UI_TYPE.figure.px}px`,
    '--hud-type-caption': `${UI_TYPE.caption.px}px`,
    '--hud-label-tracking': `${UI_LABEL_TRACKING_EM}em`,

    // Colour roles (docs/VISUAL-STYLE.md §2, §7).
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
