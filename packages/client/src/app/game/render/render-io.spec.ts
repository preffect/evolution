// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NO_HUD_INPUTS, NO_RETICLE, cellCrossingsOf, outputsBeforeAnyFrame } from './render-io';

describe('render-io', () => {
  it('answers the extent it is given and nothing drawn before any frame', () => {
    const extent = { minX: -10, maxX: 10, minY: -5, maxY: 5 };
    expect(outputsBeforeAnyFrame(extent)).toEqual({
      cameraExtent: extent,
      zoom: 0,
      visibleCells: 0,
      visibleMotes: 0,
      fragments: 0,
      effectSprites: 0,
    });
  });

  it('says nothing through the empty HUD crossings: no preview, a hidden reticle, no own-cell record', () => {
    expect(NO_HUD_INPUTS).toEqual({ previewTraitId: null, reticle: NO_RETICLE, ownCellIndicators: null });
    expect(NO_RETICLE.isVisible).toBe(false);
  });

  it('hands the cell layer the previewed trait, no relation rings without a record, and the far-dot switch', () => {
    expect(cellCrossingsOf(NO_HUD_INPUTS)).toEqual({
      previewTraitId: null,
      relationRings: undefined,
      isFarDotShown: undefined,
    });
    expect(cellCrossingsOf({ ...NO_HUD_INPUTS, isFarDotShown: false }).isFarDotShown).toBe(false);
  });
});
