// The per-cell deformation record (docs/rendering/cells.md §2.1, §2.3): what a frame's deformation
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
  /** Where the prey this cell is engulfing is (cell frame, radians): the amoeba's lobes reach for it. Absent otherwise. */
  readonly preyAngle?: number;
  /**
   * How far past the body an arm must reach to hold that prey (#753): to its centre and on by the body's coverage share
   * of its radius, in this cell's radii; 0 once the body covers it. Absent when not engulfing and not letting go (#768).
   */
  readonly armHoldRadii?: number;
  /**
   * How far the held arm has swung onto the prey and the fan turned to flank it (#768, #771). The clip tracker attaches
   * it on every engulfing and letting-go frame; absent while engulfing, the grip is full at `preyAngle`.
   */
  readonly armGrip?: ArmGrip;
}

/** The engulf grip, eased on the render clock at the grab, when the engulf ends and when the prey changes (#768, #771). */
export interface ArmGrip {
  /** Where the prey is, or was when the engulf ended, or on the way from the previous prey (cell frame, radians). */
  readonly angle: number;
  /** `NO_GRIP_SHARE` → the arm in its fan place and the fan on the heading, `FULL_GRIP_SHARE` → on the prey. */
  readonly share: number;
  /**
   * The signed turn from the held heading to `angle` the fan takes, kept the same way round from frame to frame through
   * an ease by the cell's render state (`FanTurnMemory`, #771); absent → the short way.
   */
  readonly turn?: number;
}

export const NO_GRIP_SHARE = 0;
export const FULL_GRIP_SHARE = 1;

export type CellDeformations = ReadonlyMap<EntityId, CellDeformation>;

/** A living cell with no clip playing and nothing touching it. */
export const REST_DEFORMATION: CellDeformation = { bumps: [], pulse: 1, alpha: 1 };

/** No source is wired yet: every cell rests. */
export const NO_DEFORMATIONS: CellDeformations = new Map();

export function deformationOf(deformations: CellDeformations, cellId: EntityId): CellDeformation {
  return deformations.get(cellId) ?? REST_DEFORMATION;
}
