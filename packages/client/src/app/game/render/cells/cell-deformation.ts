// The per-cell deformation record (docs/RENDERING.md §2.1, §2.3): what a frame's deformation
// sources hand one cell — its bump slots (contact dents #216, the engulf arms and eat dimple
// #207), the body pulse and the alpha of the clip tracks (#207). The layer resolves one record
// per cell id and every cell without a source wears `REST_DEFORMATION`, so a new source is a map
// entry, never a new seam.

import type { EntityId } from '@evolution/shared';
import type { ShapeBump } from './radial-profile';

export interface CellDeformation {
  /** At most `MAX_SHAPE_BUMPS`; `shape-terms.ts` pads the slots. */
  readonly bumps: readonly ShapeBump[];
  /** The body scale the clips drive (level-up, respawn, eat); 1 at rest. */
  readonly pulse: number;
  /** The whole instance's alpha (a respawning cell fades in); 1 for a living cell. */
  readonly alpha: number;
}

export type CellDeformations = ReadonlyMap<EntityId, CellDeformation>;

/** A living cell with no clip playing and nothing touching it. */
export const REST_DEFORMATION: CellDeformation = { bumps: [], pulse: 1, alpha: 1 };

/** No source is wired yet: every cell rests. */
export const NO_DEFORMATIONS: CellDeformations = new Map();

export function deformationOf(deformations: CellDeformations, cellId: EntityId): CellDeformation {
  return deformations.get(cellId) ?? REST_DEFORMATION;
}
