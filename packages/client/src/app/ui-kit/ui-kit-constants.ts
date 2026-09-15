// The UI kit's numbers (docs/ui/components-and-constants.md §10.1 owns the values; docs/CODE-STANDARDS.md §2).
// Lengths are px at scale 1: a stylesheet reads each through its `--ui-…` custom property
// (`format/ui-css-variables.ts`) and multiplies it by `var(--ui-scale)`. Colours and the type scale are
// docs/VISUAL-STYLE.md's and live in `game/render/constants/`, the two files the kit may import.

// ---- scale (docs/ui/layout.md §1) ----

/** Viewport width at which `--ui-scale` is 1. */
export const UI_REFERENCE_VIEWPORT_WIDTH_PX = 1280;
/** Viewport height at which `--ui-scale` is 1. */
export const UI_REFERENCE_VIEWPORT_HEIGHT_PX = 800;
/** Lower bound of `--ui-scale`. */
export const UI_SCALE_MIN = 0.8;
/** Upper bound of `--ui-scale`. */
export const UI_SCALE_MAX = 1.5;

// ---- spacing and shape ----

/** The spacing scale; nothing is spaced off it. */
export const UI_SPACE_XS_PX = 4;
export const UI_SPACE_S_PX = 8;
export const UI_SPACE_M_PX = 12;
export const UI_SPACE_L_PX = 16;
export const UI_SPACE_XL_PX = 24;
/** A panel's inner padding. */
export const UI_PANEL_PADDING_PX = 24;
/** Buttons, rows, fields and tables. */
export const UI_RADIUS_CONTROL_PX = 4;
/** Panels, the preview stage, tiles. */
export const UI_RADIUS_PANEL_PX = 8;
/** Every rim: a panel's, a control's, a key hint's. */
export const UI_RIM_PX = 1;

// ---- controls ----

/** A button. */
export const UI_BUTTON_HEIGHT_PX = 40;
/** A compact button, a segmented switch, a control over a preview. */
export const UI_BUTTON_COMPACT_HEIGHT_PX = 28;
/** A button label's inset. */
export const UI_BUTTON_PADDING_INLINE_PX = 16;
/** A compact button or link chip is its label plus this at each end. */
export const UI_BUTTON_COMPACT_PADDING_INLINE_PX = 12;
/** A list row. */
export const UI_ROW_HEIGHT_PX = 40;
/** A rail item. */
export const UI_RAIL_ROW_HEIGHT_PX = 36;
/** A row's leading medallion. */
export const UI_ROW_MEDALLION_PX = 24;
/** A facts-table row's leading marker when it is a dot or ring. */
export const UI_ROW_MARKER_PX = 8;
/** A facts-table row. */
export const UI_FACT_ROW_HEIGHT_PX = 26;
/** The accent bar on a selected rail item, row or tab. */
export const UI_SELECTION_BAR_PX = 3;
/** A chip. */
export const UI_CHIP_HEIGHT_PX = 20;
/** A chip is its text (and dot) plus this at each end. */
export const UI_CHIP_PADDING_INLINE_PX = 8;
/** The alert strip's pill. */
export const UI_ALERT_HEIGHT_PX = 28;
/** A keycap. */
export const UI_KEY_HINT_HEIGHT_PX = 18;
/** The search field. */
export const UI_SEARCH_WIDTH_PX = 280;
export const UI_SEARCH_HEIGHT_PX = 32;
/** The scrollbar gutter. */
export const UI_SCROLLBAR_PX = 8;
/** The fade at a scroll area's edge while content lies beyond it. */
export const UI_SCROLL_FADE_PX = 16;

/** A panel body's line height: prose, list rows and a confirm's two lines all sit in it. */
export const UI_BODY_LINE_HEIGHT = 1.45;

// ---- alphas (docs/visual-style/principles-and-palette.md §2, UI kit roles) ----

/** The hover tint, in the text colour. */
export const UI_ROW_HOVER_ALPHA = 0.06;
/** The selected tint, in the accent. */
export const UI_ROW_SELECTED_ALPHA = 0.12;
/** The pressed tint, in the text colour. */
export const UI_ROW_PRESSED_ALPHA = 0.18;
/** The callout backing inside a panel: the rail, fields, key hints, controls over a preview. */
export const UI_WELL_ALPHA = 0.45;
/** A disabled control's opacity. */
export const UI_DISABLED_ALPHA = 0.45;
/** The primary button's fill, in the accent. */
export const UI_PRIMARY_FILL_ALPHA = 0.16;
/** The primary button's rim, in the accent. */
export const UI_PRIMARY_RIM_ALPHA = 0.7;
/** The secondary and icon buttons' fill, in the text colour. */
export const UI_SECONDARY_FILL_ALPHA = 0.04;
/** The danger button's rim: 3.17:1 against `PANEL_TOP`, over the 3:1 bar for a control's boundary. */
export const UI_DANGER_RIM_ALPHA = 0.7;
/** A modal panel's top edge, in `WHITE`: the light catching the panel's upper rim. */
export const UI_PANEL_EDGE_ALPHA = 0.05;

// ---- panels ----

/** A `side` panel's width. */
export const UI_SIDE_PANEL_WIDTH_PX = 360;
/** A `side` panel's gradient opacity over the live dish. */
export const UI_SIDE_PANEL_ALPHA = 0.86;
/** The backdrop blur under a `side` panel. */
export const UI_SIDE_PANEL_BLUR_PX = 8;

// ---- focus and motion ----

/** Every control's focus ring, in the text colour, never scaled. */
export const UI_FOCUS_RING_PX = 2;
/** The ring sits this far outside the control. */
export const UI_FOCUS_RING_OFFSET_PX = 2;
/** Hover, press and selection fades. */
export const UI_TRANSITION_MS = 120;
/** A modal panel fades in rising `UI_SPACE_S_PX`, its scrim fading with it. */
export const UI_PANEL_ENTER_MS = 160;
