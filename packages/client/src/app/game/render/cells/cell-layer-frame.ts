// The cell layer's per-frame input and output (docs/rendering/budget.md §7): what the orchestrator hands
// the layer and what it reads back. Types only, so the orchestrator and the layer share one
// contract without either importing the other's implementation.

import type { CellView, EntityId, TraitId } from '@evolution/shared';
import type { RelationRing } from '../../hud/format/relations-for';
import type { RenderFrame } from '../../net/world-store';
import type { CameraExtent } from '../camera';
import type { CellDeformations } from './cell-deformation';
import type { OwnCellRing } from './self-ring';

export interface CellLayerFrame {
  readonly frame: RenderFrame;
  readonly extent: CameraExtent;
  /** Screen px per wu, for px-sized strokes and the LOD. */
  readonly zoom: number;
  /** The frame's time in ms: the clip clock of the cell effects (#207). */
  readonly nowMs: number;
  readonly ownCell: CellView | null;
  /** The HUD's hovered trait, previewed on the own cell (docs/ui/components-and-constants.md §7). */
  readonly previewTraitId: TraitId | null;
  /** This frame's per-cell deformations (contact dents #216, clip tracks #207); a missing cell rests. */
  readonly deformations: CellDeformations;
  /** The own cell's sprint ring and the escape's predator (self-ring.ts); `REST_OWN_CELL_RING` without an own cell. */
  readonly ownCellRing: OwnCellRing;
  /** The relation rings by cell id (`relationRingsOf`); absent rings no cell. */
  readonly relationRings?: ReadonlyMap<EntityId, RelationRing>;
}

export interface CellLayerOutputs {
  /** Living cells packed this frame; the ghosts of absorbed prey are counted apart. */
  readonly visibleCells: number;
  readonly ghosts: number;
  /** Organelle sprites placed this frame, the ghosts' included (the bench's sprite count, docs/rendering/budget.md §6). */
  readonly organelleSprites: number;
  /** Flagellum tails stroked this frame (one Graphics, docs/rendering/contents-and-motion.md §3). */
  readonly flagella: number;
}
