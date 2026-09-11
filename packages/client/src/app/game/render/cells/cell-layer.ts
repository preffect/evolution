// The cell layer (docs/RENDERING.md §2, §3, §6): one render state per cell in the frame (kept
// while the cell is off screen, so its slots and held heading survive a cull), the visible ones
// packed radius-ascending into the mesh, the organelle sprites between the two passes. It
// composes; every decision lives in the pure modules it calls. Culling is against the camera
// extent the orchestrator passes in, at the quad's reach; past the capacity the smallest cells
// are the ones dropped.

import type { CellView } from '@evolution/shared';
import { Container } from 'pixi.js';
import { isDiscInExtent, type CameraExtent } from '../camera';
import { CELL_INSTANCE_CAPACITY, CELL_QUAD_EXTENT_RADII } from '../constants';
import { paletteFor } from '../palette';
import type { RenderTextures } from '../render-textures';
import { ViewRegistry } from '../view-registry';
import { deformationOf } from './cell-deformation';
import { packCellInstance } from './cell-instance';
import type { CellLayerFrame, CellLayerOutputs } from './cell-layer-frame';
import { CellMesh } from './cell-mesh';
import { CellRenderState, type CellFrameContext, type CellFrameOutput } from './cell-render-state';
import { OrganelleSprites, type OrganelleDraw } from './organelle-sprites';

export type CellLayerTextures = Pick<
  RenderTextures,
  'cosmetic' | 'strip' | 'stripTexture' | 'tileTexture' | 'paletteTexture' | 'organelles'
>;

export class CellLayer {
  readonly container = new Container();
  private readonly mesh: CellMesh;
  private readonly organelles: OrganelleSprites;
  private readonly registry: ViewRegistry<CellView, CellRenderState>;

  constructor(
    private readonly textures: CellLayerTextures,
    capacity: number = CELL_INSTANCE_CAPACITY,
  ) {
    this.registry = new ViewRegistry({
      create: (view) => new CellRenderState(view.id, textures.cosmetic),
      destroy: () => undefined,
    });
    this.mesh = new CellMesh(textures, capacity);
    this.organelles = new OrganelleSprites(textures.organelles);
    this.container.addChild(this.mesh.bodyPass, this.organelles.container, this.mesh.membranePass);
  }

  /** How many render states are alive (every cell of the last frame), for a test or the bench. */
  get stateCount(): number {
    return this.registry.size;
  }

  /** The packed instance rows, `CELL_INSTANCE_FLOATS` wide each, read-only: a test or the bench reads them. */
  get instances(): Readonly<Float32Array> {
    return this.mesh.instances;
  }

  /** The cells whose quad reaches the extent, smallest first (docs/ARCHITECTURE.md §6), cut to the capacity from the small end. */
  private visibleCells(cells: readonly CellView[], extent: CameraExtent): CellView[] {
    const visible = cells
      .filter((cell) => isDiscInExtent(extent, cell.x, cell.y, cell.radius * CELL_QUAD_EXTENT_RADII))
      .sort((first, second) => first.radius - second.radius);
    return visible.length > this.mesh.capacity ? visible.slice(visible.length - this.mesh.capacity) : visible;
  }

  private frameContext(input: CellLayerFrame): CellFrameContext {
    return {
      timeSeconds: input.frame.timeSeconds,
      zoom: input.zoom,
      balance: input.frame.balance,
      ownCell: input.ownCell,
      strip: this.textures.strip,
      previewTraitId: input.previewTraitId,
    };
  }

  /** One frame: sync every state, cull, sort, update the visible ones, pack the rows, place the sprites. */
  update(input: CellLayerFrame): CellLayerOutputs {
    this.registry.sync(input.frame.cells);
    const visible = this.visibleCells(input.frame.cells, input.extent);
    const context = this.frameContext(input);
    const draws: OrganelleDraw[] = [];
    visible.forEach((view, row) => {
      const state = this.registry.get(view.id);
      if (state === undefined) return;
      const output = state.update(view, context, deformationOf(input.deformations, view.id));
      packCellInstance(this.mesh.instances, row, output.instance);
      draws.push(organelleDraw(view, output));
    });
    this.mesh.setCount(draws.length);
    this.mesh.upload();
    this.mesh.setFrame(input.frame.timeSeconds, input.zoom);
    const organelleSprites = this.organelles.update(draws, input.frame.timeSeconds);
    return { visibleCells: draws.length, organelleSprites };
  }

  destroy(): void {
    this.registry.clear();
    this.mesh.destroy();
    this.organelles.destroy();
    this.container.destroy();
  }
}

function organelleDraw(view: CellView, output: CellFrameOutput): OrganelleDraw {
  return {
    instance: output.instance,
    lod: output.lod,
    organelles: output.organelles,
    palette: paletteFor(view.avatarIndex),
    isSprinting: output.terms.isSprinting,
  };
}
