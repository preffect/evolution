import { describe, expect, it } from 'vitest';
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
import {
  HUD_NOTICE_ROWS_VARIABLE,
  HUD_SCALE_VARIABLE,
  hudStyleVariables,
  noticeRowsVariable,
} from './hud-css-variables';

describe('noticeRowsVariable', () => {
  it('publishes the live notice row count, unitless, beside the constant map', () => {
    expect(noticeRowsVariable(2)).toEqual({ [HUD_NOTICE_ROWS_VARIABLE]: '2' });
    expect(HUD_NOTICE_ROWS_VARIABLE in hudStyleVariables(1)).toBe(false);
  });
});

const TEST_SCALE = 1.25;

/**
 * Every entry the bridge may publish, against the constant it must come from. The bridge is the
 * only thing keeping a HUD number to one home, so this table is exhaustive by contract: the last
 * case asserts the published keys are exactly these, which is what stops a hand-typed value
 * joining the map with a green gate.
 */
const PUBLISHED_VARIABLES: readonly (readonly [string, string])[] = [
  [HUD_SCALE_VARIABLE, String(TEST_SCALE)],

  ['--hud-margin', `${HUD_MARGIN_PX}px`],
  ['--hud-leaderboard-width', `${LEADERBOARD_WIDTH_PX}px`],
  ['--hud-leaderboard-full-width', `${LEADERBOARD_FULL_WIDTH_PX}px`],
  ['--hud-leaderboard-header-height', `${LEADERBOARD_HEADER_HEIGHT_PX}px`],
  ['--hud-leaderboard-row-height', `${LEADERBOARD_ROW_HEIGHT_PX}px`],
  ['--hud-leaderboard-label-row-height', `${LEADERBOARD_LABEL_ROW_HEIGHT_PX}px`],
  ['--hud-leaderboard-swatch-size', `${LEADERBOARD_SWATCH_DIAMETER_PX}px`],
  ['--hud-leaderboard-padding', `${LEADERBOARD_PADDING_PX}px`],
  ['--hud-leaderboard-corner-radius', `${LEADERBOARD_CORNER_RADIUS_PX}px`],

  ['--hud-leaderboard-rank-column', `${LEADERBOARD_RANK_COLUMN_PX}px`],
  ['--hud-leaderboard-swatch-column', `${LEADERBOARD_SWATCH_COLUMN_PX}px`],
  ['--hud-leaderboard-level-column', `${LEADERBOARD_LEVEL_COLUMN_PX}px`],
  ['--hud-leaderboard-number-column', `${LEADERBOARD_NUMBER_COLUMN_PX}px`],
  ['--hud-leaderboard-column-gap', `${LEADERBOARD_COLUMN_GAP_PX}px`],

  ['--hud-row-slide-duration', `${LEADERBOARD_ROW_SLIDE_MS}ms`],
  ['--hud-leaderboard-expand-duration', `${LEADERBOARD_EXPAND_MS}ms`],
  ['--hud-clock-pulse-duration', `${ROUND_CLOCK_PULSE_PERIOD_MS}ms`],
  ['--hud-focus-ring', `${HUD_FOCUS_RING_PX}px`],

  ['--hud-exclusion', `${HUD_PLAYER_EXCLUSION_PX}px`],
  ['--hud-picker-band-gap', `${PICKER_BAND_GAP_PX}px`],
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

  ['--hud-notice-row-height', `${NOTICE_ROW_HEIGHT_PX}px`],
  ['--hud-notice-stack-max-y', `${NOTICE_STACK_MAX_Y_PX}px`],
  ['--hud-notice-padding-inline', `${NOTICE_PADDING_INLINE_PX}px`],
  ['--hud-notice-gap', `${NOTICE_GAP_PX}px`],
  ['--hud-notice-rim', `${NOTICE_RIM_PX}px`],
  ['--hud-connection-lost-dim-alpha', String(CONNECTION_LOST_DIM_ALPHA)],
  ['--hud-danger', DANGER],
  ['--hud-callout-backing', CALLOUT_BACKING],

  ['--hud-font-sans', UI_TYPE.body.font],
  ['--hud-font-mono', UI_TYPE.clock.font],
  ['--hud-font-figure', UI_TYPE.figure.font],
  ['--hud-type-clock', `${UI_TYPE.clock.px}px`],
  ['--hud-type-body', `${UI_TYPE.body.px}px`],
  ['--hud-type-figure', `${UI_TYPE.figure.px}px`],
  ['--hud-type-caption', `${UI_TYPE.caption.px}px`],
  ['--hud-type-title', `${UI_TYPE.title.px}px`],
  ['--hud-type-value', `${UI_TYPE.value.px}px`],
  ['--hud-type-card-name', `${UI_TYPE.cardName.px}px`],
  ['--hud-type-label', `${UI_TYPE.label.px}px`],
  ['--hud-label-tracking', `${UI_LABEL_TRACKING_EM}em`],

  ['--hud-text', TEXT],
  ['--hud-text-label', TEXT_LABEL],
  ['--hud-text-muted', TEXT_MUTED],
  ['--hud-panel-top', PANEL_TOP],
  ['--hud-panel-bottom', PANEL_BOTTOM],
  ['--hud-panel-rim', PANEL_RIM],
  ['--hud-level-gold', LEVEL_GOLD],
  ['--hud-outline', OUTLINE],
  ['--hud-white', WHITE],
];

describe('hudStyleVariables', () => {
  it.each(PUBLISHED_VARIABLES)('publishes %s from its constant, never a copy', (name, expected) => {
    expect(hudStyleVariables(TEST_SCALE)[name]).toBe(expected);
  });

  it('publishes exactly these and nothing else, so an unpinned value cannot join the map', () => {
    expect(Object.keys(hudStyleVariables(TEST_SCALE)).sort()).toEqual(PUBLISHED_VARIABLES.map(([name]) => name).sort());
  });

  it('carries the scale it is given, unitless, so a length can multiply by it', () => {
    expect(hudStyleVariables(1)[HUD_SCALE_VARIABLE]).toBe('1');
    expect(hudStyleVariables(0.8)[HUD_SCALE_VARIABLE]).toBe('0.8');
  });

  it('names every variable with the --hud- prefix, so a stylesheet cannot read a stray one', () => {
    for (const name of Object.keys(hudStyleVariables(1))) expect(name.startsWith('--hud-')).toBe(true);
  });

  it('publishes each type role whole — a size with its own face (docs/visual-style/ui-type.md §7)', () => {
    const variables = hudStyleVariables(1);
    expect(variables['--hud-type-body']).toBe(`${UI_TYPE.body.px}px`);
    expect(variables['--hud-font-sans']).toBe(UI_TYPE.body.font);
    expect(variables['--hud-type-figure']).toBe(`${UI_TYPE.figure.px}px`);
    expect(variables['--hud-font-figure']).toBe(UI_TYPE.figure.font);
    // `figure` is `body`'s size in the mono face: the numeric columns keep the row's weight.
    expect(UI_TYPE.figure.px).toBe(UI_TYPE.body.px);
  });
});
