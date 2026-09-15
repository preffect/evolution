import { describe, expect, it } from 'vitest';
import {
  CALLOUT_BACKING,
  DANGER,
  DNA,
  LEVEL_GOLD,
  PANEL_BOTTOM,
  PANEL_RIM,
  PANEL_TOP,
  TEXT,
  TEXT_LABEL,
  TEXT_MUTED,
  UI_ACCENT,
  WHITE,
} from '../../game/render/constants/colours';
import { UI_FONT_MONO, UI_FONT_SANS, UI_LABEL_TRACKING_EM, UI_TYPE } from '../../game/render/constants/ui-type';
import * as kit from '../ui-kit-constants';
import { UI_SCALE_VARIABLE, colourAtAlpha, uiScaleVariable, uiStyleVariables } from './ui-css-variables';

/** Read by `uiScaleFor` alone, never by a stylesheet, so they are not published. */
const SCALE_FORMULA_CONSTANTS = new Set([
  'UI_REFERENCE_VIEWPORT_WIDTH_PX',
  'UI_REFERENCE_VIEWPORT_HEIGHT_PX',
  'UI_SCALE_MIN',
  'UI_SCALE_MAX',
]);

const EXPECTED_TYPE: Readonly<Record<string, string>> = {
  '--ui-font-sans': UI_FONT_SANS,
  '--ui-font-mono': UI_FONT_MONO,
  '--ui-label-tracking': `${UI_LABEL_TRACKING_EM}em`,
  '--ui-type-number': `${UI_TYPE.number.px}px`,
  '--ui-type-headline': `${UI_TYPE.headline.px}px`,
  '--ui-type-clock': `${UI_TYPE.clock.px}px`,
  '--ui-type-title': `${UI_TYPE.title.px}px`,
  '--ui-type-value': `${UI_TYPE.value.px}px`,
  '--ui-type-card-name': `${UI_TYPE.cardName.px}px`,
  '--ui-type-body': `${UI_TYPE.body.px}px`,
  '--ui-type-figure': `${UI_TYPE.figure.px}px`,
  '--ui-type-label': `${UI_TYPE.label.px}px`,
  '--ui-type-caption': `${UI_TYPE.caption.px}px`,
};

const EXPECTED_COLOURS: Readonly<Record<string, string>> = {
  '--ui-text': TEXT,
  '--ui-text-label': TEXT_LABEL,
  '--ui-text-muted': TEXT_MUTED,
  '--ui-panel-top': PANEL_TOP,
  '--ui-panel-bottom': PANEL_BOTTOM,
  '--ui-panel-rim': PANEL_RIM,
  '--ui-accent': UI_ACCENT,
  '--ui-callout-backing': CALLOUT_BACKING,
  '--ui-white': WHITE,
  '--ui-danger': DANGER,
  '--ui-level-gold': LEVEL_GOLD,
  '--ui-dna': DNA,
  '--ui-hover': colourAtAlpha(TEXT, kit.UI_ROW_HOVER_ALPHA),
  '--ui-pressed': colourAtAlpha(TEXT, kit.UI_ROW_PRESSED_ALPHA),
  '--ui-selected': colourAtAlpha(UI_ACCENT, kit.UI_ROW_SELECTED_ALPHA),
  '--ui-link': UI_ACCENT,
  '--ui-well': colourAtAlpha(CALLOUT_BACKING, kit.UI_WELL_ALPHA),
};

const EXPECTED_CONSTANTS: Readonly<Record<string, string>> = {
  '--ui-body-line-height': String(kit.UI_BODY_LINE_HEIGHT),
  '--ui-space-xs': `${kit.UI_SPACE_XS_PX}px`,
  '--ui-space-s': `${kit.UI_SPACE_S_PX}px`,
  '--ui-space-m': `${kit.UI_SPACE_M_PX}px`,
  '--ui-space-l': `${kit.UI_SPACE_L_PX}px`,
  '--ui-space-xl': `${kit.UI_SPACE_XL_PX}px`,
  '--ui-panel-padding': `${kit.UI_PANEL_PADDING_PX}px`,
  '--ui-radius-control': `${kit.UI_RADIUS_CONTROL_PX}px`,
  '--ui-radius-panel': `${kit.UI_RADIUS_PANEL_PX}px`,
  '--ui-rim': `${kit.UI_RIM_PX}px`,
  '--ui-side-panel-width': `${kit.UI_SIDE_PANEL_WIDTH_PX}px`,
  '--ui-side-panel-alpha': String(kit.UI_SIDE_PANEL_ALPHA),
  '--ui-side-panel-blur': `${kit.UI_SIDE_PANEL_BLUR_PX}px`,
  '--ui-scrollbar': `${kit.UI_SCROLLBAR_PX}px`,
  '--ui-scroll-fade': `${kit.UI_SCROLL_FADE_PX}px`,
  '--ui-focus-ring': `${kit.UI_FOCUS_RING_PX}px`,
  '--ui-focus-ring-offset': `${kit.UI_FOCUS_RING_OFFSET_PX}px`,
  '--ui-transition': `${kit.UI_TRANSITION_MS}ms`,
  '--ui-panel-enter': `${kit.UI_PANEL_ENTER_MS}ms`,
  '--ui-button-height': `${kit.UI_BUTTON_HEIGHT_PX}px`,
  '--ui-button-compact-height': `${kit.UI_BUTTON_COMPACT_HEIGHT_PX}px`,
  '--ui-button-padding-inline': `${kit.UI_BUTTON_PADDING_INLINE_PX}px`,
  '--ui-button-compact-padding-inline': `${kit.UI_BUTTON_COMPACT_PADDING_INLINE_PX}px`,
  '--ui-row-height': `${kit.UI_ROW_HEIGHT_PX}px`,
  '--ui-rail-row-height': `${kit.UI_RAIL_ROW_HEIGHT_PX}px`,
  '--ui-row-medallion': `${kit.UI_ROW_MEDALLION_PX}px`,
  '--ui-card-medallion': `${kit.UI_CARD_MEDALLION_PX}px`,
  '--ui-row-marker': `${kit.UI_ROW_MARKER_PX}px`,
  '--ui-row-marker-ring': `${kit.UI_ROW_MARKER_RING_PX}px`,
  '--ui-fact-row-height': `${kit.UI_FACT_ROW_HEIGHT_PX}px`,
  '--ui-selection-bar': `${kit.UI_SELECTION_BAR_PX}px`,
  '--ui-chip-height': `${kit.UI_CHIP_HEIGHT_PX}px`,
  '--ui-chip-padding-inline': `${kit.UI_CHIP_PADDING_INLINE_PX}px`,
  '--ui-chip-dot': `${kit.UI_CHIP_DOT_PX}px`,
  '--ui-alert-height': `${kit.UI_ALERT_HEIGHT_PX}px`,
  '--ui-key-hint-height': `${kit.UI_KEY_HINT_HEIGHT_PX}px`,
  '--ui-search-width': `${kit.UI_SEARCH_WIDTH_PX}px`,
  '--ui-search-height': `${kit.UI_SEARCH_HEIGHT_PX}px`,
  '--ui-row-hover-alpha': String(kit.UI_ROW_HOVER_ALPHA),
  '--ui-row-selected-alpha': String(kit.UI_ROW_SELECTED_ALPHA),
  '--ui-row-pressed-alpha': String(kit.UI_ROW_PRESSED_ALPHA),
  '--ui-well-alpha': String(kit.UI_WELL_ALPHA),
  '--ui-disabled-alpha': String(kit.UI_DISABLED_ALPHA),
  '--ui-primary-fill-alpha': String(kit.UI_PRIMARY_FILL_ALPHA),
  '--ui-primary-rim-alpha': String(kit.UI_PRIMARY_RIM_ALPHA),
  '--ui-secondary-fill-alpha': String(kit.UI_SECONDARY_FILL_ALPHA),
  '--ui-danger-rim-alpha': String(kit.UI_DANGER_RIM_ALPHA),
  '--ui-panel-edge-alpha': String(kit.UI_PANEL_EDGE_ALPHA),
  '--ui-scroll-thumb-alpha': String(kit.UI_SCROLL_THUMB_ALPHA),
};

/** The naming rule of §10.1: drop `UI_` and `_PX`/`_MS`, kebab-case. */
function tokenNameFor(constantName: string): string {
  return `--ui-${constantName
    .replace(/^UI_/, '')
    .replace(/_(PX|MS)$/, '')
    .toLowerCase()
    .replaceAll('_', '-')}`;
}

function tokenValueFor(constantName: string, value: number): string {
  if (constantName.endsWith('_PX')) return `${value}px`;
  if (constantName.endsWith('_MS')) return `${value}ms`;
  return String(value);
}

describe('uiStyleVariables', () => {
  const published = uiStyleVariables();

  it('publishes exactly the pinned entries: nothing unpinned joins the map', () => {
    expect(published).toEqual({ ...EXPECTED_TYPE, ...EXPECTED_COLOURS, ...EXPECTED_CONSTANTS });
  });

  it('publishes every kit constant but the scale formula, by the one naming rule', () => {
    const constants = Object.entries(kit).filter(([name]) => !SCALE_FORMULA_CONSTANTS.has(name));
    expect(constants.length).toBe(Object.keys(EXPECTED_CONSTANTS).length);
    for (const [name, value] of constants) {
      expect(published[tokenNameFor(name)], name).toBe(tokenValueFor(name, value));
    }
  });

  it('publishes a type role per UI_TYPE role, kebab-cased', () => {
    const roleKeys = Object.keys(published).filter((key) => key.startsWith('--ui-type-'));
    expect(roleKeys).toHaveLength(Object.keys(UI_TYPE).length);
  });

  it('draws the kit roles as existing colours at the kit alphas (docs/visual-style/principles-and-palette.md §2)', () => {
    expect(published['--ui-hover']).toBe(`color-mix(in srgb, ${TEXT} 6%, transparent)`);
    expect(published['--ui-pressed']).toBe(`color-mix(in srgb, ${TEXT} 18%, transparent)`);
    expect(published['--ui-selected']).toBe(`color-mix(in srgb, ${UI_ACCENT} 12%, transparent)`);
    expect(published['--ui-well']).toBe(`color-mix(in srgb, ${CALLOUT_BACKING} 45%, transparent)`);
  });
});

describe('uiScaleVariable', () => {
  it('publishes the live scale under --ui-scale', () => {
    expect(uiScaleVariable(1.25)).toEqual({ [UI_SCALE_VARIABLE]: '1.25' });
    expect(UI_SCALE_VARIABLE).toBe('--ui-scale');
  });
});
