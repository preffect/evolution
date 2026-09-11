// The cell layer's per-frame input and output (docs/RENDERING.md §7): what the orchestrator hands
// the layer and what it reads back. Types only, so the orchestrator and the layer share one
// contract without either importing the other's implementation.

import type { CellView, TraitId } from '@evolution/shared';
import type { RenderFrame } from '../../net/world-store';
import type { CameraExtent } from '../camera';
import type { CellDeformations } from './cell-deformation';

export interface CellLayerFrame {
  readonly frame: RenderFrame;
  readonly extent: CameraExtent;
  /** Screen px per wu, for px-sized strokes and the LOD. */
  readonly zoom: number;
  /** The frame's time in ms: the clip clock of the cell effects (#207). */
  readonly nowMs: number;
  readonly ownCell: CellView | null;
  /** The HUD's hovered trait, previewed on the own cell (docs/UI.md §7). */
  readonly previewTraitId: TraitId | null;
  /** This frame's per-cell deformations (contact dents #216, clip tracks #207); a missing cell rests. */
  readonly deformations: CellDeformations;
}

export interface CellLayerOutputs {
  readonly visibleCells: number;
  /** Organelle sprites placed this frame (the bench's sprite count, docs/RENDERING.md §6). */
  readonly organelleSprites: number;
}
