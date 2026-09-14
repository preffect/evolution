import { describe, expect, it } from 'vitest';
import { createTestRenderTextures } from '../../../../testing/fake-pixi-app';
import { INDICATOR_SHEET } from '../constants';
import { LADDER_SILHOUETTE } from '../../state/own-cell-indicators';
import { endosymbiontTallies } from '../textures/pip-block-bake';
import { flowSheetRows, indicatorSheetRows } from './indicator-sheet';

const TALLIES = endosymbiontTallies();

describe('indicatorSheetRows', () => {
  it('shows every ghost, every pip block, the pills and the numerals (the rings are the arc panel)', () => {
    const [ghosts, ...rest] = indicatorSheetRows(createTestRenderTextures().indicators);
    expect(ghosts).toHaveLength(Object.values(LADDER_SILHOUETTE).length + TALLIES.length);
    const pipRows = rest.slice(0, TALLIES.length);
    expect(pipRows.map((row) => row.length)).toEqual(TALLIES.map((tally) => tally.required + 1));
    expect(rest.at(-2)).toEqual(INDICATOR_SHEET.labelTexts.map((text) => ({ kind: 'pill', text })));
    expect(rest.at(-1)).toEqual(INDICATOR_SHEET.numeralTexts.map((text) => ({ kind: 'numeral', text })));
  });
});

describe('flowSheetRows', () => {
  it('centres items left to right with the item gap, rows top to bottom by their tallest item', () => {
    const centres = flowSheetRows(
      [
        [
          { width: 10, height: 4 },
          { width: 20, height: 8 },
        ],
        [{ width: 6, height: 6 }],
      ],
      { x: 100, y: 50 },
    );
    expect(centres).toEqual([
      [
        { x: 105, y: 54 },
        { x: 110 + INDICATOR_SHEET.itemGapPx + 10, y: 54 },
      ],
      [{ x: 103, y: 50 + 8 + INDICATOR_SHEET.rowGapPx + 3 }],
    ]);
  });
});

// `attachIndicatorSheet` builds `BitmapText`, whose glyph atlas needs a real 2D canvas (jsdom has none): the
// view is checked by the rendered sheet itself (qa/evidence), the session's wiring of it in bench-session.spec.ts.
