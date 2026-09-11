// Cells as flat discs (docs/RENDERING.md §3.0, "the placeholder disc"): one Graphics per cell in its
// palette's base with the rim colour as a thin edge, the own cell wearing the self ring, culled to the
// camera extent. Slice B (#206) replaces this file with `cells/cell-layer.ts` (the SDF material);
// the frame input, the `visibleCells` output and the view-registry lifecycle stay as they are here.

import type { CellView, TraitId } from '@evolution/shared';
import { Container, Graphics } from 'pixi.js';
import type { RenderFrame } from '../net/world-store';
import { isDiscInExtent, type CameraExtent } from './camera';
import { hexToNumber } from './colour';
import {
  RIM_LIGHT_WIDTH_RADII,
  SELF_RING_ALPHA,
  SELF_RING_RADIUS_FRACTION,
  SELF_RING_WIDTH_PX,
  WHITE,
} from './constants';
import { paletteFor } from './palette';
import { ViewRegistry } from './view-registry';

export interface CellLayerFrame {
  readonly frame: RenderFrame;
  readonly extent: CameraExtent;
  /** Screen px per wu, for px-sized strokes. */
  readonly zoom: number;
  /** The frame's time in ms: the clip clock of the cell effects (slice B). */
  readonly nowMs: number;
  readonly ownCell: CellView | null;
  /** The HUD's hovered trait, previewed on the own cell (slice B; docs/UI.md §7). */
  readonly previewTraitId: TraitId | null;
}

export interface CellLayerOutputs {
  readonly visibleCells: number;
}

interface CellDisc {
  readonly body: Graphics;
  readonly selfRing: Graphics;
}

const UNIT_RADIUS = 1;

function createDisc(cell: CellView): CellDisc {
  const palette = paletteFor(cell.avatarIndex);
  const body = new Graphics()
    .circle(0, 0, UNIT_RADIUS)
    .fill(hexToNumber(palette.base))
    .stroke({ width: RIM_LIGHT_WIDTH_RADII, color: hexToNumber(palette.rim), alignment: 1 });
  const selfRing = new Graphics();
  selfRing.visible = false;
  body.addChild(selfRing);
  return { body, selfRing };
}

/** The self ring in the cell's unit frame: `SELF_RING_WIDTH_PX` on screen, so it is redrawn as the zoom moves. */
function drawSelfRing(ring: Graphics, radius: number, zoom: number): void {
  ring
    .clear()
    .circle(0, 0, SELF_RING_RADIUS_FRACTION)
    .stroke({ width: SELF_RING_WIDTH_PX / (zoom * radius), color: hexToNumber(WHITE), alpha: SELF_RING_ALPHA });
}

export class PlaceholderCellLayer {
  readonly container = new Container();
  private readonly registry = new ViewRegistry<CellView, CellDisc>({
    create: (cell) => {
      const disc = createDisc(cell);
      this.container.addChild(disc.body);
      return disc;
    },
    destroy: (disc) => disc.body.destroy({ children: true }),
  });

  /** Syncs one disc per cell, places it, and hides the ones outside the extent. */
  update(input: CellLayerFrame): CellLayerOutputs {
    let visibleCells = 0;
    for (const [cell, disc] of this.registry.sync(input.frame.cells).pairs) {
      const isVisible = isDiscInExtent(input.extent, cell.x, cell.y, cell.radius);
      disc.body.visible = isVisible;
      if (!isVisible) continue;
      visibleCells += 1;
      disc.body.position.set(cell.x, cell.y);
      disc.body.scale.set(cell.radius);
      const isOwn = input.ownCell !== null && cell.id === input.ownCell.id;
      disc.selfRing.visible = isOwn;
      if (isOwn) drawSelfRing(disc.selfRing, cell.radius, input.zoom);
    }
    return { visibleCells };
  }

  destroy(): void {
    this.registry.clear();
    this.container.destroy({ children: true });
  }
}
