import { describe, expect, it } from 'vitest';
import { createFakeBakeCanvasFactory, type FakeBakeCanvas } from '../../../../testing/fake-bake-canvas';
import { ORGANELLE_KIND } from '../cells/organelle-kinds';
import { ORGANELLE_ATLAS_MAX_DPR, ORGANELLE_ATLAS_PX_PER_R } from '../constants';
import { atlasPxPerRadius, bakeOrganelleAtlas } from './organelle-atlas';

describe('bakeOrganelleAtlas', () => {
  const atlas = bakeOrganelleAtlas(createFakeBakeCanvasFactory(), 1);
  const paints = (kind: keyof typeof atlas) => (atlas[kind].canvas as FakeBakeCanvas).context.paintCount;

  it('bakes one sprite per organelle kind, each wider than its body for its halo', () => {
    expect(Object.keys(atlas).sort()).toEqual(Object.values(ORGANELLE_KIND).sort());
    for (const sprite of Object.values(atlas)) {
      expect(sprite.widthRadii).toBeGreaterThan(0);
      expect(sprite.canvas.width).toBe(Math.ceil(sprite.widthRadii * ORGANELLE_ATLAS_PX_PER_R));
    }
  });

  it('layers every sprite five deep or more, the nucleus deepest', () => {
    for (const kind of Object.values(ORGANELLE_KIND)) expect(paints(kind)).toBeGreaterThanOrEqual(4);
    expect(paints(ORGANELLE_KIND.nucleus)).toBeGreaterThan(paints(ORGANELLE_KIND.lipid));
    expect(paints(ORGANELLE_KIND.mitochondrion)).toBeGreaterThan(paints(ORGANELLE_KIND.foodVacuole));
  });

  it('scales the bake with the device pixel ratio up to the cap', () => {
    expect(atlasPxPerRadius(1)).toBe(ORGANELLE_ATLAS_PX_PER_R);
    expect(atlasPxPerRadius(1.5)).toBe(ORGANELLE_ATLAS_PX_PER_R * 2);
    expect(atlasPxPerRadius(3)).toBe(ORGANELLE_ATLAS_PX_PER_R * ORGANELLE_ATLAS_MAX_DPR);
    expect(bakeOrganelleAtlas(createFakeBakeCanvasFactory(), 2).nucleus.canvas.width).toBe(
      atlas.nucleus.canvas.width * 2,
    );
  });
});
