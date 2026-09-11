import { describe, expect, it } from 'vitest';
import { RANDOM_STREAM, createSeededRandom } from '@evolution/shared';
import { createFakeBakeCanvasFactory, fakeContextOf } from '../../../../testing/fake-bake-canvas';
import {
  MITO_BASE,
  ORGANELLE_ATLAS_MAX_DPR,
  ORGANELLE_ATLAS_PX_PER_R,
  ORGANELLE_HALO_ALPHA,
  ORGANELLE_KIND,
  TOXIN_GLOW,
  VACUOLE_FILL_ALPHA,
  VAC_BASE,
  type OrganelleKind,
} from '../constants';
import { hexWithAlpha } from '../colour';
import { atlasPxPerRadius, bakeOrganelleAtlas } from './organelle-atlas';

function cosmetic(seed = 1) {
  return createSeededRandom(seed).fork(RANDOM_STREAM.cosmetic);
}

describe('bakeOrganelleAtlas', () => {
  const atlas = bakeOrganelleAtlas(createFakeBakeCanvasFactory(), 1, cosmetic());
  const paints = (kind: OrganelleKind) => fakeContextOf(atlas[kind].canvas).paintCount;
  const haloColour = (kind: OrganelleKind) => fakeContextOf(atlas[kind].canvas).gradients[0]!.stops[0]!.colour;

  it('bakes one sprite per organelle kind, each as wide as its canvas in radii', () => {
    expect(Object.keys(atlas).sort()).toEqual(Object.values(ORGANELLE_KIND).sort());
    for (const sprite of Object.values(atlas)) {
      expect(sprite.widthRadii).toBeGreaterThan(0);
      expect(sprite.canvas.width).toBe(Math.ceil(sprite.widthRadii * ORGANELLE_ATLAS_PX_PER_R));
    }
  });

  it('layers every sprite three deep or more (the nucleoid: glow and two strokes), the detailed ones deeper', () => {
    for (const kind of Object.values(ORGANELLE_KIND)) expect(paints(kind)).toBeGreaterThanOrEqual(3);
    expect(paints(ORGANELLE_KIND.nucleoid)).toBe(3);
    expect(paints(ORGANELLE_KIND.nucleus)).toBeGreaterThan(paints(ORGANELLE_KIND.lipid));
    expect(paints(ORGANELLE_KIND.mitochondrion)).toBeGreaterThan(paints(ORGANELLE_KIND.foodVacuole));
    expect(paints(ORGANELLE_KIND.chloroplast)).toBeGreaterThan(paints(ORGANELLE_KIND.foodVacuole));
  });

  it('starts every sprite with its halo in its own colour and ends it with a glint', () => {
    expect(haloColour(ORGANELLE_KIND.mitochondrion)).toBe(hexWithAlpha(MITO_BASE, ORGANELLE_HALO_ALPHA));
    expect(haloColour(ORGANELLE_KIND.toxinVacuole)).toBe(hexWithAlpha(TOXIN_GLOW, ORGANELLE_HALO_ALPHA));
    expect(haloColour(ORGANELLE_KIND.foodVacuole)).toBe(hexWithAlpha(VAC_BASE, ORGANELLE_HALO_ALPHA));
    for (const kind of [ORGANELLE_KIND.chloroplast, ORGANELLE_KIND.lipid, ORGANELLE_KIND.foodVacuole]) {
      expect(fakeContextOf(atlas[kind].canvas).ops.at(-1)).toBe('fill');
      expect(fakeContextOf(atlas[kind].canvas).count('ellipse')).toBe(1);
    }
  });

  it('fills the food vacuole as sheet 01 draws it: the vacuole blue, faint at the centre, denser at the rim', () => {
    const fill = fakeContextOf(atlas[ORGANELLE_KIND.foodVacuole].canvas).gradients[1]!.stops;
    expect(fill[0]!.colour).toBe(hexWithAlpha(VAC_BASE, VACUOLE_FILL_ALPHA.inner));
    expect(fill.at(-1)!.colour).toBe(hexWithAlpha(VAC_BASE, VACUOLE_FILL_ALPHA.outer));
  });

  it('scales the bake with the device pixel ratio up to the cap', () => {
    expect(atlasPxPerRadius(1)).toBe(ORGANELLE_ATLAS_PX_PER_R);
    expect(atlasPxPerRadius(1.5)).toBe(ORGANELLE_ATLAS_PX_PER_R * 2);
    expect(atlasPxPerRadius(3)).toBe(ORGANELLE_ATLAS_PX_PER_R * ORGANELLE_ATLAS_MAX_DPR);
    const retina = bakeOrganelleAtlas(createFakeBakeCanvasFactory(), 2, cosmetic());
    expect(Math.abs(retina.nucleus.canvas.width - atlas.nucleus.canvas.width * 2)).toBeLessThanOrEqual(1);
    expect(retina.nucleus.widthRadii).toBeCloseTo(atlas.nucleus.widthRadii, 1);
  });
});
