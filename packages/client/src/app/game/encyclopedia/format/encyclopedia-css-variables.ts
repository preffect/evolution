// The one bridge between `encyclopedia-constants.ts` and the panel's stylesheets (docs/CODE-STANDARDS.md §2), the
// shape `hud/format/hud-css-variables.ts` set: a stylesheet cannot read a TypeScript constant, so the panel publishes
// every number §11.7 owns as a `--encyclopedia-…` custom property on its own host and each stylesheet reads it back.
// Pure and pinned entry by entry, so a hand-typed value cannot join the map unnoticed.
//
// Lengths carry their unit at scale 1; a stylesheet scales one with `calc(var(--encyclopedia-…) * var(--ui-scale))`,
// which is the kit's scale, published by the `[uiSurface]` the panel sits on. The kit's own numbers stay
// `--ui-…`: nothing here restates one, and `pixels` and `milliseconds` are the kit's own — a token's value is
// written one way in this codebase, not one way per feature.

import { TRAIT_GLYPH_CARD_PX } from '../../glyphs/glyph-constants';
import { UI_ROW_MEDALLION_PX } from '../../../ui-kit/ui-kit-constants';
import { milliseconds, pixels, type StyleVariables } from '../../../ui-kit/format/ui-css-variables';
import {
  ENCYCLOPEDIA_CONTENT_MAX_WIDTH_PX,
  ENCYCLOPEDIA_HEADER_HEIGHT_PX,
  ENCYCLOPEDIA_INSET_PX,
  ENCYCLOPEDIA_LENS_DIAMETER_PX,
  ENCYCLOPEDIA_LENS_GAP_PX,
  ENCYCLOPEDIA_LENS_LOADING_PULSE_MIN_ALPHA,
  ENCYCLOPEDIA_LENS_LOADING_PULSE_MS,
  ENCYCLOPEDIA_LENS_TEXT_WIDTH_FRACTION,
  ENCYCLOPEDIA_LIST_WIDTH_PX,
  ENCYCLOPEDIA_MAX_HEIGHT_PX,
  ENCYCLOPEDIA_MAX_WIDTH_PX,
  ENCYCLOPEDIA_PROSE_MAX_WIDTH_PX,
  ENCYCLOPEDIA_RAIL_ICON_PX,
  ENCYCLOPEDIA_RAIL_WIDTH_PX,
  ENCYCLOPEDIA_TILE_HEIGHT_PX,
  ENCYCLOPEDIA_TILE_PREVIEW_HEIGHT_PX,
  ENCYCLOPEDIA_TILE_WIDTH_PX,
} from '../encyclopedia-constants';

/** Every `--encyclopedia-…` token the panel's stylesheets may read, by name, at scale 1. */
export function encyclopediaStyleVariables(): StyleVariables {
  return {
    '--encyclopedia-inset': pixels(ENCYCLOPEDIA_INSET_PX),
    '--encyclopedia-max-width': pixels(ENCYCLOPEDIA_MAX_WIDTH_PX),
    '--encyclopedia-max-height': pixels(ENCYCLOPEDIA_MAX_HEIGHT_PX),
    '--encyclopedia-header-height': pixels(ENCYCLOPEDIA_HEADER_HEIGHT_PX),
    '--encyclopedia-rail-width': pixels(ENCYCLOPEDIA_RAIL_WIDTH_PX),
    '--encyclopedia-rail-icon': pixels(ENCYCLOPEDIA_RAIL_ICON_PX),
    '--encyclopedia-list-width': pixels(ENCYCLOPEDIA_LIST_WIDTH_PX),
    '--encyclopedia-tile-width': pixels(ENCYCLOPEDIA_TILE_WIDTH_PX),
    '--encyclopedia-tile-height': pixels(ENCYCLOPEDIA_TILE_HEIGHT_PX),
    '--encyclopedia-tile-well-height': pixels(ENCYCLOPEDIA_TILE_PREVIEW_HEIGHT_PX),
    // The entry page (docs/ui/encyclopedia.md §11.4): the two lengths the page is laid out with.
    '--encyclopedia-content-max-width': pixels(ENCYCLOPEDIA_CONTENT_MAX_WIDTH_PX),
    '--encyclopedia-lens-diameter': pixels(ENCYCLOPEDIA_LENS_DIAMETER_PX),
    '--encyclopedia-lens-gap': pixels(ENCYCLOPEDIA_LENS_GAP_PX),
    // The lens's own numbers (#466). The rim, the inner ring and the vignette are **not** here any more: they moved
    // from the reserved box's CSS into the lens's SVG overlay, which takes its geometry and its opacities straight
    // from the constants (`format/lens-overlay.ts`) and only its colours from a `--ui-…` role. What is left is what
    // the lens's own stylesheet still reads — a fraction of the diameter, a duration and an alpha.
    '--encyclopedia-lens-text-width-fraction': String(ENCYCLOPEDIA_LENS_TEXT_WIDTH_FRACTION),
    '--encyclopedia-lens-loading-pulse': milliseconds(ENCYCLOPEDIA_LENS_LOADING_PULSE_MS),
    '--encyclopedia-lens-loading-min-alpha': String(ENCYCLOPEDIA_LENS_LOADING_PULSE_MIN_ALPHA),
    '--encyclopedia-prose-max-width': pixels(ENCYCLOPEDIA_PROSE_MAX_WIDTH_PX),
    // The glyph sizes the rows and tiles draw at (docs/ui/encyclopedia.md §11.3). A row's glyph **is** its medallion
    // — both kinds draw their own disc and rim (components-and-constants.md §10.2) — so it is the kit's
    // `UI_ROW_MEDALLION_PX`, which is what the reference frame measures; `TRAIT_GLYPH_LIST_PX` is the smaller size
    // the menu's trait list draws at, and naming it here left every row 4 px under the frame. A tile's is the
    // picker's card medallion, which `glyphs/` and `hud/` already share.
    '--encyclopedia-row-glyph': pixels(UI_ROW_MEDALLION_PX),
    '--encyclopedia-tile-glyph': pixels(TRAIT_GLYPH_CARD_PX),
  };
}
