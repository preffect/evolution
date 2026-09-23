// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DNA_RING_STROKE_PX, GAIN, OUTLINE, TREND_GLYPH_PX } from '../../render/constants';
import { uiStyleVariables } from '../../../ui-kit/format/ui-css-variables';
import {
  AFFECTING_MASS_ROW_GAP_PX,
  AFFECTING_SPARKLINE_HEIGHT_PX,
  AFFECTING_SPARKLINE_STROKE_PX,
  AFFECTING_SPARKLINE_WIDTH_PX,
  CONNECTION_LOST_DIM_ALPHA,
  HUD_MARGIN_PX,
  NOTICE_GAP_PX,
  NOTICE_PADDING_INLINE_PX,
  NOTICE_RIM_PX,
  HINT_RIM_PX,
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
import {
  HUD_NOTICE_ROWS_VARIABLE,
  HUD_PICKER_BAND_OFFSET_VARIABLE,
  HUD_PICKER_SPOTLIGHT_VARIABLE,
  hudStyleVariables,
  noticeRowsVariable,
  pickerBandVariables,
} from './hud-css-variables';
import { pickerBandOffsetPx, pickerSpotlightRadiusPx } from './picker-band';
import { TRAIT_GLYPH_LIST_PX } from '../../glyphs/glyph-constants';

describe('pickerBandVariables', () => {
  it('publishes the band offset and the dim radius for the viewport, in real px, beside the constant map', () => {
    const viewport = { width: 2560, height: 1440 };
    expect(pickerBandVariables(viewport)).toEqual({
      [HUD_PICKER_BAND_OFFSET_VARIABLE]: `${pickerBandOffsetPx(viewport)}px`,
      [HUD_PICKER_SPOTLIGHT_VARIABLE]: `${pickerSpotlightRadiusPx(viewport)}px`,
    });
    expect(HUD_PICKER_BAND_OFFSET_VARIABLE in hudStyleVariables()).toBe(false);
  });
});

describe('noticeRowsVariable', () => {
  it('publishes the live notice row count, unitless, beside the constant map', () => {
    expect(noticeRowsVariable(2)).toEqual({ [HUD_NOTICE_ROWS_VARIABLE]: '2' });
    expect(HUD_NOTICE_ROWS_VARIABLE in hudStyleVariables()).toBe(false);
  });
});

/**
 * Every entry the bridge may publish, against the constant it must come from. The bridge is the
 * only thing keeping a HUD number to one home, so this table is exhaustive by contract: the last
 * case asserts the published keys are exactly these, which is what stops a hand-typed value
 * joining the map with a green gate.
 */
const PUBLISHED_VARIABLES: readonly (readonly [string, string])[] = [
  ['--hud-margin', `${HUD_MARGIN_PX}px`],
  ['--hud-leaderboard-width', `${LEADERBOARD_WIDTH_PX}px`],
  ['--hud-leaderboard-full-width', `${LEADERBOARD_FULL_WIDTH_PX}px`],
  ['--hud-leaderboard-header-height', `${LEADERBOARD_HEADER_HEIGHT_PX}px`],
  ['--hud-leaderboard-row-height', `${LEADERBOARD_ROW_HEIGHT_PX}px`],
  ['--hud-leaderboard-label-row-height', `${LEADERBOARD_LABEL_ROW_HEIGHT_PX}px`],
  ['--hud-leaderboard-footer-row-height', `${LEADERBOARD_FOOTER_ROW_HEIGHT_PX}px`],
  ['--hud-leaderboard-swatch-size', `${LEADERBOARD_SWATCH_DIAMETER_PX}px`],
  ['--hud-leaderboard-padding', `${LEADERBOARD_PADDING_PX}px`],
  ['--hud-leaderboard-corner-radius', `${LEADERBOARD_CORNER_RADIUS_PX}px`],
  ['--hud-leaderboard-rim', `${LEADERBOARD_RIM_PX}px`],

  ['--hud-leaderboard-rank-column', `${LEADERBOARD_RANK_COLUMN_PX}px`],
  ['--hud-leaderboard-swatch-column', `${LEADERBOARD_SWATCH_COLUMN_PX}px`],
  ['--hud-leaderboard-level-column', `${LEADERBOARD_LEVEL_COLUMN_PX}px`],
  ['--hud-leaderboard-score-column', `${LEADERBOARD_SCORE_COLUMN_PX}px`],
  ['--hud-leaderboard-mass-column', `${LEADERBOARD_MASS_COLUMN_PX}px`],
  ['--hud-leaderboard-engulfs-column', `${LEADERBOARD_ENGULFS_COLUMN_PX}px`],
  ['--hud-leaderboard-column-gap', `${LEADERBOARD_COLUMN_GAP_PX}px`],

  ['--hud-row-slide-duration', `${LEADERBOARD_ROW_SLIDE_MS}ms`],
  ['--hud-leaderboard-expand-duration', `${LEADERBOARD_EXPAND_MS}ms`],
  ['--hud-clock-pulse-duration', `${ROUND_CLOCK_PULSE_PERIOD_MS}ms`],

  ['--hud-picker-row-gap', `${PICKER_ROW_GAP_PX}px`],
  ['--hud-picker-timer-width', `${PICKER_TIMER_BAR_WIDTH_PX}px`],
  ['--hud-picker-card-width', `${PICKER_CARD_WIDTH_PX}px`],
  ['--hud-picker-card-height', `${PICKER_CARD_HEIGHT_PX}px`],
  ['--hud-picker-card-gap', `${PICKER_CARD_GAP_PX}px`],
  ['--hud-picker-medallion', `${PICKER_CARD_MEDALLION_PX}px`],
  ['--hud-picker-card-lift', `${PICKER_CARD_LIFT_PX}px`],
  ['--hud-picker-timer-height', `${DNA_RING_STROKE_PX}px`],
  ['--hud-picker-dim-alpha', String(PICKER_DIM_ALPHA)],
  ['--hud-picker-dim-soft-edge', String(PICKER_DIM_SOFT_EDGE_FRACTION)],
  ['--hud-picker-card-content-gap', `${PICKER_CARD_CONTENT_GAP_PX}px`],
  ['--hud-picker-card-padding-block', `${PICKER_CARD_PADDING_BLOCK_PX}px`],
  ['--hud-picker-card-padding-inline', `${PICKER_CARD_PADDING_INLINE_PX}px`],
  ['--hud-picker-card-glow', `${PICKER_CARD_GLOW_PX}px`],
  ['--hud-picker-highlight-duration', `${PICKER_CARD_HIGHLIGHT_MS}ms`],
  ['--hud-picker-ribbon-padding-inline', `${PICKER_RIBBON_PADDING_INLINE_PX}px`],

  ['--hud-menu-panel-width', `${MENU_PANEL_WIDTH_PX}px`],
  ['--hud-menu-trait-row-height', `${MENU_TRAIT_ROW_HEIGHT_PX}px`],
  ['--hud-menu-trait-line-height', `${MENU_TRAIT_LINE_HEIGHT_PX}px`],
  ['--hud-menu-trait-glyph', `${TRAIT_GLYPH_LIST_PX}px`],

  ['--hud-notice-row-height', `${NOTICE_ROW_HEIGHT_PX}px`],
  ['--hud-affecting-mass-row-gap', `${AFFECTING_MASS_ROW_GAP_PX}px`],
  ['--hud-affecting-sparkline-width', `${AFFECTING_SPARKLINE_WIDTH_PX}px`],
  ['--hud-affecting-sparkline-height', `${AFFECTING_SPARKLINE_HEIGHT_PX}px`],
  ['--hud-affecting-sparkline-stroke', `${AFFECTING_SPARKLINE_STROKE_PX}px`],
  ['--hud-affecting-trend-glyph', `${TREND_GLYPH_PX}px`],
  ['--hud-affecting-trait-glyph', `${TRAIT_GLYPH_LIST_PX}px`],

  ['--hud-notice-stack-max-y', `${NOTICE_STACK_MAX_Y_PX}px`],
  ['--hud-notice-padding-inline', `${NOTICE_PADDING_INLINE_PX}px`],
  ['--hud-notice-gap', `${NOTICE_GAP_PX}px`],
  ['--hud-notice-rim', `${NOTICE_RIM_PX}px`],
  ['--hud-hint-rim', `${HINT_RIM_PX}px`],
  ['--hud-connection-lost-dim-alpha', String(CONNECTION_LOST_DIM_ALPHA)],

  ['--hud-outline', OUTLINE],
  ['--hud-gain', GAIN],
];

describe('hudStyleVariables', () => {
  it.each(PUBLISHED_VARIABLES)('publishes %s from its constant, never a copy', (name, expected) => {
    expect(hudStyleVariables()[name]).toBe(expected);
  });

  it('publishes exactly these and nothing else, so an unpinned value cannot join the map', () => {
    expect(Object.keys(hudStyleVariables()).sort()).toEqual(PUBLISHED_VARIABLES.map(([name]) => name).sort());
  });

  it('names every variable with the --hud- prefix, so a stylesheet cannot read a stray one', () => {
    for (const name of Object.keys(hudStyleVariables())) expect(name.startsWith('--hud-')).toBe(true);
  });

  it('leaves the type, colour, focus ring and scale to the kit, which the same shell publishes (#381)', () => {
    const kit = uiStyleVariables();
    for (const role of ['type-body', 'font-sans', 'font-mono', 'text', 'panel-rim', 'danger', 'focus-ring', 'scale']) {
      expect(`--hud-${role}` in hudStyleVariables()).toBe(false);
    }
    expect(kit['--ui-type-body']).toBeDefined();
    expect(kit['--ui-text']).toBeDefined();
    expect(kit['--ui-focus-ring']).toBeDefined();
  });
});
