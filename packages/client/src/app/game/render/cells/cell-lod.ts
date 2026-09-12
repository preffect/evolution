// The LOD rule (docs/RENDERING.md §5, docs/VISUAL-STYLE.md §6): interior bands and sprites fade
// in a window under the full threshold; the identity tells snap at the far threshold; below it
// the cell is a rim-colour dot with a wide halo.

import { CELL_LOD_FAR_MAX_PX, CELL_LOD_FULL_MIN_PX, LOD_FADE_BAND_PX } from '../constants';
import { clamp01 } from '../geometry';

export const LOD_LEVEL = { full: 'full', mid: 'mid', far: 'far' } as const;
export type LodLevel = (typeof LOD_LEVEL)[keyof typeof LOD_LEVEL];

export interface CellLod {
  readonly level: LodLevel;
  /** `r × zoom` in CSS px, the value the rule was decided on; px-sized tells read it back. */
  readonly screenRadiusPx: number;
  /** 0 → 1 over the `LOD_FADE_BAND_PX` window under `CELL_LOD_FULL_MIN_PX`: interior bands and sprites. */
  readonly interiorBlend: number;
  /** Seat mark and self ring: drawn at mid and above, never faded. */
  readonly hasTells: boolean;
  /** The nucleus / nucleoid sprite: the stage tell, kept through mid (VISUAL-STYLE §6) and gone with the far dot. */
  readonly nucleusBlend: number;
  /** Below the far threshold the cell is a rim dot with a ×3 halo. */
  readonly isFarDot: boolean;
}

/** `screenRadiusPx` is `r × zoom` in CSS px; `resolution` never moves the thresholds. */
export function cellLodFor(screenRadiusPx: number): CellLod {
  const isFarDot = screenRadiusPx < CELL_LOD_FAR_MAX_PX;
  const level = screenRadiusPx >= CELL_LOD_FULL_MIN_PX ? LOD_LEVEL.full : isFarDot ? LOD_LEVEL.far : LOD_LEVEL.mid;
  const interiorBlend = clamp01((screenRadiusPx - (CELL_LOD_FULL_MIN_PX - LOD_FADE_BAND_PX)) / LOD_FADE_BAND_PX);
  return { level, screenRadiusPx, interiorBlend, hasTells: !isFarDot, nucleusBlend: isFarDot ? 0 : 1, isFarDot };
}
