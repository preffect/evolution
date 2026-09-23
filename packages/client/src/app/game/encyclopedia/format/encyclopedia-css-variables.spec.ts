// @vitest-environment node
// The bridge exists only to stop a number being typed twice (docs/CODE-STANDARDS.md §2), so this spec pins it entry
// by entry: the exact key set, and each value against the constant it came from. A hand-typed value cannot join the
// map unnoticed, and a token no stylesheet reads cannot linger in it.

import { describe, expect, it } from 'vitest';
import { TRAIT_GLYPH_CARD_PX } from '../../glyphs/glyph-constants';
import { UI_ROW_MEDALLION_PX } from '../../../ui-kit/ui-kit-constants';
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
  ENCYCLOPEDIA_TILE_FACT_LINES,
  ENCYCLOPEDIA_TILE_FACT_LINE_HEIGHT,
  ENCYCLOPEDIA_TILE_HEIGHT_PX,
  ENCYCLOPEDIA_TILE_PREVIEW_HEIGHT_PX,
  ENCYCLOPEDIA_TILE_WIDTH_PX,
} from '../encyclopedia-constants';
import { encyclopediaStyleVariables } from './encyclopedia-css-variables';

const EXPECTED: readonly (readonly [string, string])[] = [
  ['--encyclopedia-inset', `${ENCYCLOPEDIA_INSET_PX}px`],
  ['--encyclopedia-max-width', `${ENCYCLOPEDIA_MAX_WIDTH_PX}px`],
  ['--encyclopedia-max-height', `${ENCYCLOPEDIA_MAX_HEIGHT_PX}px`],
  ['--encyclopedia-header-height', `${ENCYCLOPEDIA_HEADER_HEIGHT_PX}px`],
  ['--encyclopedia-rail-width', `${ENCYCLOPEDIA_RAIL_WIDTH_PX}px`],
  ['--encyclopedia-rail-icon', `${ENCYCLOPEDIA_RAIL_ICON_PX}px`],
  ['--encyclopedia-list-width', `${ENCYCLOPEDIA_LIST_WIDTH_PX}px`],
  ['--encyclopedia-tile-width', `${ENCYCLOPEDIA_TILE_WIDTH_PX}px`],
  ['--encyclopedia-tile-height', `${ENCYCLOPEDIA_TILE_HEIGHT_PX}px`],
  ['--encyclopedia-tile-well-height', `${ENCYCLOPEDIA_TILE_PREVIEW_HEIGHT_PX}px`],
  ['--encyclopedia-tile-fact-lines', String(ENCYCLOPEDIA_TILE_FACT_LINES)],
  ['--encyclopedia-tile-fact-line-height', String(ENCYCLOPEDIA_TILE_FACT_LINE_HEIGHT)],
  ['--encyclopedia-content-max-width', `${ENCYCLOPEDIA_CONTENT_MAX_WIDTH_PX}px`],
  ['--encyclopedia-lens-diameter', `${ENCYCLOPEDIA_LENS_DIAMETER_PX}px`],
  ['--encyclopedia-lens-gap', `${ENCYCLOPEDIA_LENS_GAP_PX}px`],
  ['--encyclopedia-lens-text-width-fraction', String(ENCYCLOPEDIA_LENS_TEXT_WIDTH_FRACTION)],
  ['--encyclopedia-lens-loading-pulse', `${ENCYCLOPEDIA_LENS_LOADING_PULSE_MS}ms`],
  ['--encyclopedia-lens-loading-min-alpha', String(ENCYCLOPEDIA_LENS_LOADING_PULSE_MIN_ALPHA)],
  ['--encyclopedia-prose-max-width', `${ENCYCLOPEDIA_PROSE_MAX_WIDTH_PX}px`],
  ['--encyclopedia-row-glyph', `${UI_ROW_MEDALLION_PX}px`],
  ['--encyclopedia-tile-glyph', `${TRAIT_GLYPH_CARD_PX}px`],
];

describe('encyclopediaStyleVariables (docs/ui/encyclopedia.md §11.7)', () => {
  it('publishes exactly these keys, and no others', () => {
    expect(Object.keys(encyclopediaStyleVariables()).sort()).toEqual(EXPECTED.map(([key]) => key).sort());
  });

  it.each(EXPECTED)('publishes %s from its constant', (key, value) => {
    expect(encyclopediaStyleVariables()[key]).toBe(value);
  });

  it('restates none of the kit’s own tokens: every key is the encyclopedia’s', () => {
    expect(Object.keys(encyclopediaStyleVariables()).filter((key) => key.startsWith('--ui-'))).toEqual([]);
  });
});
