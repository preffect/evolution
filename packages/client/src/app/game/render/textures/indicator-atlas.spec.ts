import { describe, expect, it } from 'vitest';
import { createFakeBakeCanvasFactory, fakeContextOf } from '../../../../testing/fake-bake-canvas';
import { hexWithAlpha } from '../colour';
import { GHOST_BAKE, INDICATOR_BAKE_MAX_DPR, MITO_BASE, WHITE } from '../constants';
import { LADDER_SILHOUETTE } from '../../state/own-cell-indicators';
import { bakeIndicatorAtlas, indicatorBakeScale } from './indicator-atlas';
import { endosymbiontTallies, pipBlockKey } from './pip-block-bake';

const TALLIES = endosymbiontTallies();

describe('bakeIndicatorAtlas', () => {
  const atlas = bakeIndicatorAtlas(createFakeBakeCanvasFactory(), 1);

  it('bakes a ghost for every key the orbit layout can hand the drawing: each rung silhouette and each endosymbiont', () => {
    const keys = [...Object.values(LADDER_SILHOUETTE), ...TALLIES.map((tally) => tally.traitId)];
    expect(Object.keys(atlas.ghosts).sort()).toEqual([...keys].sort());
  });

  it('bakes one pip block per (variant, eaten) from 0 to required, so every clamped lookup hits', () => {
    const expected = TALLIES.reduce((sum, tally) => sum + tally.required + 1, 0);
    expect(Object.keys(atlas.pipBlocks)).toHaveLength(expected);
    for (const tally of TALLIES) {
      for (const eaten of [-3, 0, tally.required - 1, tally.required, tally.required + 2]) {
        expect(
          atlas.pipBlocks[pipBlockKey(tally.variant, eaten, tally.required)],
          `${tally.variant} ${eaten}`,
        ).toBeDefined();
      }
    }
  });

  it("bakes the rung ghosts white for the rim tint and each counter's ghost in its organelle colour", () => {
    const haloOf = (key: keyof typeof atlas.ghosts) =>
      fakeContextOf(atlas.ghosts[key]!.canvas).gradients[0]!.stops[0]!.colour;
    expect(haloOf(LADDER_SILHOUETTE.envelope)).toBe(hexWithAlpha(WHITE, GHOST_BAKE.haloAlpha));
    expect(haloOf('mitochondrion')).toBe(hexWithAlpha(MITO_BASE, GHOST_BAKE.haloAlpha));
  });

  it('scales every bake with the device pixel ratio rounded up, to the cap', () => {
    expect(indicatorBakeScale(1)).toBe(1);
    expect(indicatorBakeScale(1.25)).toBe(2);
    expect(indicatorBakeScale(3)).toBe(INDICATOR_BAKE_MAX_DPR);
    const retina = bakeIndicatorAtlas(createFakeBakeCanvasFactory(), 2);
    // Two texels per px, and the same px size to within the one-texel round-up of each canvas.
    expect(retina.unlockRing.canvas.width / 2).toBe(retina.unlockRing.widthPx);
    expect(Math.abs(retina.unlockRing.widthPx - atlas.unlockRing.widthPx)).toBeLessThanOrEqual(1);
  });
});
