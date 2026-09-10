// docs/RENDERING.md §9: the LOD thresholds and the fade window under the full threshold.

import { describe, expect, it } from 'vitest';
import { CELL_LOD_FAR_MAX_PX, CELL_LOD_FULL_MIN_PX, LOD_FADE_BAND_PX } from '../constants';
import { LOD_LEVEL, cellLodFor } from './cell-lod';

describe('cellLodFor', () => {
  it('is full at and above 20 px with the interior fully blended', () => {
    const lod = cellLodFor(CELL_LOD_FULL_MIN_PX);
    expect(lod.level).toBe(LOD_LEVEL.full);
    expect(lod.interiorBlend).toBe(1);
    expect(lod.hasTells).toBe(true);
    expect(cellLodFor(60).level).toBe(LOD_LEVEL.full);
  });

  it('fades the interior over the 6 px window under the full threshold', () => {
    expect(cellLodFor(CELL_LOD_FULL_MIN_PX - LOD_FADE_BAND_PX / 2).interiorBlend).toBeCloseTo(0.5, 9);
    expect(cellLodFor(CELL_LOD_FULL_MIN_PX - LOD_FADE_BAND_PX).interiorBlend).toBe(0);
    expect(cellLodFor(CELL_LOD_FULL_MIN_PX - LOD_FADE_BAND_PX / 2).level).toBe(LOD_LEVEL.mid);
  });

  it('keeps the tells through mid LOD and drops them with the far dot under 8 px', () => {
    expect(cellLodFor(CELL_LOD_FAR_MAX_PX).hasTells).toBe(true);
    expect(cellLodFor(CELL_LOD_FAR_MAX_PX).level).toBe(LOD_LEVEL.mid);
    const far = cellLodFor(CELL_LOD_FAR_MAX_PX - 0.5);
    expect(far.level).toBe(LOD_LEVEL.far);
    expect(far.isFarDot).toBe(true);
    expect(far.hasTells).toBe(false);
    expect(far.interiorBlend).toBe(0);
  });
});
