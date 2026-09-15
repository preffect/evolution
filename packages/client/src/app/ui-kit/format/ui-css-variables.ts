// The one bridge between the kit's constant homes and its stylesheets (docs/ui/components-and-constants.md §10.1).
//
// A stylesheet cannot read a TypeScript constant, so a `[uiSurface]` publishes every kit token as a custom
// property and every kit stylesheet reads `var(--ui-…)`. The names follow one rule, so none is looked up: a
// constant drops `UI_` and `_PX`/`_MS` and is kebab-cased, a colour role is kebab-cased, and a type role is
// `--ui-type-<role>`. The spec pins every entry and the exact key set, so a hand-typed value cannot join the
// map unnoticed. Lengths carry their unit at scale 1; a stylesheet scales one with
// `calc(var(--ui-…) * var(--ui-scale))`.

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

/** The custom property a surface sets from its live box; every kit length multiplies by it. */
export const UI_SCALE_VARIABLE = '--ui-scale';

export type StyleVariables = Readonly<Record<string, string>>;

const PERCENT_PER_UNIT = 100;

/** A colour at an alpha, as CSS: `color-mix` takes a hex or a `var(--ui-…)` alike. */
export function colourAtAlpha(colour: string, alpha: number): string {
  return `color-mix(in srgb, ${colour} ${alpha * PERCENT_PER_UNIT}%, transparent)`;
}

function pixels(value: number): string {
  return `${value}px`;
}

function milliseconds(value: number): string {
  return `${value}ms`;
}

/** `cardName` → `card-name`: a type role's key is its kebab-cased name. */
function kebabCase(camelCaseName: string): string {
  return camelCaseName.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** The type roles and faces of docs/visual-style/ui-type.md §7. */
function typeVariables(): StyleVariables {
  const roles = Object.entries(UI_TYPE).map(([role, { px: size }]) => [`--ui-type-${kebabCase(role)}`, pixels(size)]);
  return {
    '--ui-font-sans': UI_FONT_SANS,
    '--ui-font-mono': UI_FONT_MONO,
    '--ui-label-tracking': `${UI_LABEL_TRACKING_EM}em`,
    '--ui-body-line-height': String(kit.UI_BODY_LINE_HEIGHT),
    ...Object.fromEntries(roles),
  };
}

/** The colour roles of docs/visual-style/principles-and-palette.md §2, the kit's among them. */
function colourVariables(): StyleVariables {
  return {
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
}

/** Spacing, shape and the panels (§10.1's table). */
function layoutVariables(): StyleVariables {
  return {
    '--ui-space-xs': pixels(kit.UI_SPACE_XS_PX),
    '--ui-space-s': pixels(kit.UI_SPACE_S_PX),
    '--ui-space-m': pixels(kit.UI_SPACE_M_PX),
    '--ui-space-l': pixels(kit.UI_SPACE_L_PX),
    '--ui-space-xl': pixels(kit.UI_SPACE_XL_PX),
    '--ui-panel-padding': pixels(kit.UI_PANEL_PADDING_PX),
    '--ui-radius-control': pixels(kit.UI_RADIUS_CONTROL_PX),
    '--ui-radius-panel': pixels(kit.UI_RADIUS_PANEL_PX),
    '--ui-rim': pixels(kit.UI_RIM_PX),
    '--ui-side-panel-width': pixels(kit.UI_SIDE_PANEL_WIDTH_PX),
    '--ui-side-panel-alpha': String(kit.UI_SIDE_PANEL_ALPHA),
    '--ui-side-panel-blur': pixels(kit.UI_SIDE_PANEL_BLUR_PX),
    '--ui-scrollbar': pixels(kit.UI_SCROLLBAR_PX),
    '--ui-scroll-fade': pixels(kit.UI_SCROLL_FADE_PX),
    '--ui-focus-ring': pixels(kit.UI_FOCUS_RING_PX),
    '--ui-focus-ring-offset': pixels(kit.UI_FOCUS_RING_OFFSET_PX),
    '--ui-transition': milliseconds(kit.UI_TRANSITION_MS),
    '--ui-panel-enter': milliseconds(kit.UI_PANEL_ENTER_MS),
  };
}

/** The controls' sizes (§10.1's table). */
function controlVariables(): StyleVariables {
  return {
    '--ui-button-height': pixels(kit.UI_BUTTON_HEIGHT_PX),
    '--ui-button-compact-height': pixels(kit.UI_BUTTON_COMPACT_HEIGHT_PX),
    '--ui-button-padding-inline': pixels(kit.UI_BUTTON_PADDING_INLINE_PX),
    '--ui-button-compact-padding-inline': pixels(kit.UI_BUTTON_COMPACT_PADDING_INLINE_PX),
    '--ui-row-height': pixels(kit.UI_ROW_HEIGHT_PX),
    '--ui-rail-row-height': pixels(kit.UI_RAIL_ROW_HEIGHT_PX),
    '--ui-row-medallion': pixels(kit.UI_ROW_MEDALLION_PX),
    '--ui-row-marker': pixels(kit.UI_ROW_MARKER_PX),
    '--ui-fact-row-height': pixels(kit.UI_FACT_ROW_HEIGHT_PX),
    '--ui-selection-bar': pixels(kit.UI_SELECTION_BAR_PX),
    '--ui-chip-height': pixels(kit.UI_CHIP_HEIGHT_PX),
    '--ui-chip-padding-inline': pixels(kit.UI_CHIP_PADDING_INLINE_PX),
    '--ui-alert-height': pixels(kit.UI_ALERT_HEIGHT_PX),
    '--ui-key-hint-height': pixels(kit.UI_KEY_HINT_HEIGHT_PX),
    '--ui-search-width': pixels(kit.UI_SEARCH_WIDTH_PX),
    '--ui-search-height': pixels(kit.UI_SEARCH_HEIGHT_PX),
  };
}

/** The alphas a stylesheet mixes a colour role at (§10.1's table). */
function alphaVariables(): StyleVariables {
  return {
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
  };
}

/** Every `--ui-…` token a kit stylesheet may read, by name, at scale 1. */
export function uiStyleVariables(): StyleVariables {
  return {
    ...typeVariables(),
    ...colourVariables(),
    ...layoutVariables(),
    ...controlVariables(),
    ...alphaVariables(),
  };
}

/** The live scale, published beside the map: it is state, not a constant. */
export function uiScaleVariable(scale: number): StyleVariables {
  return { [UI_SCALE_VARIABLE]: String(scale) };
}
