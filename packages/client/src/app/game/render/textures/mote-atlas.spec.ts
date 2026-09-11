import { describe, expect, it } from 'vitest';
import { DNA_TAGS } from '@evolution/shared';
import { createFakeBakeCanvasFactory, fakeContextOf } from '../../../../testing/fake-bake-canvas';
import { MOTE_ATLAS_PX_PER_WU, MOTE_SMALL_VARIANT_PX_PER_WU } from '../constants';
import { MOTE_SPRITE, bakeMoteAtlas } from './mote-atlas';

describe('bakeMoteAtlas', () => {
  const atlas = bakeMoteAtlas(createFakeBakeCanvasFactory());

  it('bakes every mote sprite in full and small, and a helix per tag', () => {
    expect(Object.keys(atlas.full).sort()).toEqual(Object.values(MOTE_SPRITE).sort());
    expect(Object.keys(atlas.small).sort()).toEqual(Object.values(MOTE_SPRITE).sort());
    expect(Object.keys(atlas.fragments).sort()).toEqual([...DNA_TAGS].sort());
    expect(atlas.fullPxPerWu).toBe(MOTE_ATLAS_PX_PER_WU);
    expect(atlas.smallPxPerWu).toBe(MOTE_SMALL_VARIANT_PX_PER_WU);
    expect(atlas.full.algae.width).toBe(
      atlas.small.algae.width * (MOTE_ATLAS_PX_PER_WU / MOTE_SMALL_VARIANT_PX_PER_WU),
    );
  });

  it('layers each sprite: glow, body, edge or bands, rim and a glint (five or more paints)', () => {
    for (const canvas of Object.values(atlas.full)) expect(fakeContextOf(canvas).paintCount).toBeGreaterThanOrEqual(5);
    expect(fakeContextOf(atlas.full.bacterium_photosynthetic).paintCount).toBeGreaterThan(
      fakeContextOf(atlas.full.bacterium_plain).paintCount,
    );
    for (const canvas of Object.values(atlas.fragments))
      expect(fakeContextOf(canvas).paintCount).toBeGreaterThanOrEqual(5);
  });

  it('gives the algae a circle, the detritus an oily ellipse, both glinted', () => {
    const algae = fakeContextOf(atlas.full.algae);
    const detritus = fakeContextOf(atlas.full.detritus);
    expect(algae.count('ellipse')).toBe(1);
    expect(detritus.count('ellipse')).toBe(3);
    expect(algae.ops.at(-1)).toBe('fill');
    expect(detritus.ops.at(-1)).toBe('fill');
  });
});
