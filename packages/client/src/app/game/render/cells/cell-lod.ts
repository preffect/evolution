// The LOD rule (docs/RENDERING.md §5, docs/VISUAL-STYLE.md §6): interior bands fade in a window
// under the full threshold; the identity and danger tells snap at the far threshold.

import { CELL_LOD_FAR_MAX_PX, CELL_LOD_FULL_MIN_PX, LOD_FADE_BAND_PX } from '../constants';
import { clamp01 } from '../geometry';

export const LOD_LEVEL = { full: 'full', mid: 'mid', far: 'far' } as const;
export type LodLevel = (typeof LOD_LEVEL)[keyof typeof LOD_LEVEL];

export interface CellLod {
  readonly level: LodLevel;
  /** 0 → 1 over the `LOD_FADE_BAND_PX` window under `CELL_LOD_FULL_MIN_PX`: interior bands, sprites, hairs. */
  readonly interiorBlend: number;
  /** Seat mark, self ring and warning ring: drawn at mid and above, never faded. */
  readonly hasTells: boolean;
  /** Below the far threshold the cell is a rim dot with a ×3 halo. */
  readonly isFarDot: boolean;
}

/** `screenRadiusPx` is `r × zoom` in CSS px; `resolution` never moves the thresholds. */
export function cellLodFor(screenRadiusPx: number): CellLod {
  const isFarDot = screenRadiusPx < CELL_LOD_FAR_MAX_PX;
  const level = screenRadiusPx >= CELL_LOD_FULL_MIN_PX ? LOD_LEVEL.full : isFarDot ? LOD_LEVEL.far : LOD_LEVEL.mid;
  const interiorBlend = clamp01((screenRadiusPx - (CELL_LOD_FULL_MIN_PX - LOD_FADE_BAND_PX)) / LOD_FADE_BAND_PX);
  return { level, interiorBlend, hasTells: !isFarDot, isFarDot };
}
