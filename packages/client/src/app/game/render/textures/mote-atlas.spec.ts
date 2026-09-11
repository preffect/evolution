import { describe, expect, it } from 'vitest';
import { DNA_TAGS } from '@evolution/shared';
import { createFakeBakeCanvasFactory, type FakeBakeCanvas } from '../../../../testing/fake-bake-canvas';
import { MOTE_ATLAS_PX_PER_WU, MOTE_SMALL_VARIANT_PX_PER_WU } from '../constants';
import { MOTE_SPRITE, bakeMoteAtlas } from './mote-atlas';

describe('bakeMoteAtlas', () => {
  const atlas = bakeMoteAtlas(createFakeBakeCanvasFactory());
  const paints = (canvas: unknown) => (canvas as FakeBakeCanvas).context.paintCount;

  it('bakes every mote sprite in full and small, and a helix per tag', () => {
    expect(Object.keys(atlas.full).sort()).toEqual(Object.values(MOTE_SPRITE).sort());
    expect(Object.keys(atlas.small).sort()).toEqual(Object.values(MOTE_SPRITE).sort());
    expect(Object.keys(atlas.fragments).sort()).toEqual([...DNA_TAGS].sort());
    expect(atlas.fullPxPerWu).toBe(MOTE_ATLAS_PX_PER_WU);
    expect(atlas.smallPxPerWu).toBe(MOTE_SMALL_VARIANT_PX_PER_WU);
    expect(atlas.full.algae.width).toBeGreaterThan(atlas.small.algae.width);
  });

  it('layers each sprite: glow, body, edge or bands, rim and a glint (five or more paints)', () => {
    for (const canvas of Object.values(atlas.full)) expect(paints(canvas)).toBeGreaterThanOrEqual(5);
    expect(paints(atlas.full.bacterium_photosynthetic)).toBeGreaterThan(paints(atlas.full.bacterium_plain));
    for (const canvas of Object.values(atlas.fragments)) expect(paints(canvas)).toBeGreaterThanOrEqual(5);
  });

  it('tints the fragment halo with the tag colour', () => {
    const motile = atlas.fragments.motile as FakeBakeCanvas;
    expect(motile.context.gradients[0]!.stops[0]!.colour).toBe('rgba(102, 236, 255, 0.2)');
  });
});
