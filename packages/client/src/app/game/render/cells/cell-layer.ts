// The cell layer (docs/RENDERING.md §2, §3, §6): one render state per visible cell, the instance
// rows packed radius-ascending into the mesh, the organelle sprites between the two passes. It
// composes; every decision lives in the pure modules it calls. Culling is against the camera
// extent the orchestrator passes in, at the quad's reach.

import type { CellView } from '@evolution/shared';
import { Container } from 'pixi.js';
import { isDiscInExtent, type CameraExtent } from '../camera';
import { CELL_QUAD_EXTENT_RADII } from '../constants';
import { paletteFor } from '../palette';
import type { RenderTextures } from '../render-textures';
import { ViewRegistry } from '../view-registry';
import { packCellInstance } from './cell-instance';
import type { CellLayerFrame, CellLayerOutputs } from './cell-layer-frame';
import { CellMesh } from './cell-mesh';
import { CellRenderState, type CellFrameContext, type CellFrameOutput } from './cell-render-state';
import type { ShapeBump } from './radial-profile';
import { OrganelleSprites, type OrganelleDraw } from './organelle-sprites';

export type CellLayerTextures = Pick<
  RenderTextures,
  'cosmetic' | 'strip' | 'stripTexture' | 'tileTexture' | 'paletteTexture' | 'organelles'
>;

/** No deformation source hands in bumps yet (contact dents #216, clip tracks #207). */
const NO_BUMPS: readonly ShapeBump[] = [];

export class CellLayer {
  readonly container = new Container();
  private readonly mesh: CellMesh;
  private readonly organelles: OrganelleSprites;
  private readonly registry: ViewRegistry<CellView, CellRenderState>;

  constructor(private readonly textures: CellLayerTextures) {
    this.registry = new ViewRegistry({
      create: (view) => new CellRenderState(view.id, textures.cosmetic),
      destroy: () => undefined,
    });
    this.mesh = new CellMesh(textures);
    this.organelles = new OrganelleSprites(textures.organelles);
    this.container.addChild(this.mesh.bodyPass, this.organelles.container, this.mesh.membranePass);
  }

  /** How many render states are alive, for a test or the bench. */
  get stateCount(): number {
    return this.registry.size;
  }

  /** The cells whose quad reaches the extent, smallest first (docs/ARCHITECTURE.md §6). */
  private visibleCells(cells: readonly CellView[], extent: CameraExtent): CellView[] {
    return cells
      .filter((cell) => isDiscInExtent(extent, cell.x, cell.y, cell.radius * CELL_QUAD_EXTENT_RADII))
      .sort((first, second) => first.radius - second.radius);
  }

  private frameContext(input: CellLayerFrame): CellFrameContext {
    return {
      timeSeconds: input.frame.timeSeconds,
      zoom: input.zoom,
      balance: input.frame.balance,
      ownCell: input.ownCell,
      strip: this.textures.strip,
      previewTraitId: input.previewTraitId,
      bumps: NO_BUMPS,
    };
  }

  /** One frame: cull, sort, update every state, pack the rows, place the sprites. */
  update(input: CellLayerFrame): CellLayerOutputs {
    const visible = this.visibleCells(input.frame.cells, input.extent);
    const { pairs } = this.registry.sync(visible);
    const context = this.frameContext(input);
    const draws: OrganelleDraw[] = [];
    let row = 0;
    for (const [view, state] of pairs) {
      if (row >= this.mesh.capacity) break;
      const output = state.update(view, context);
      packCellInstance(this.mesh.instances, row, output.instance);
      draws.push(organelleDraw(view, output));
      row += 1;
    }
    this.mesh.setCount(row);
    this.mesh.upload();
    this.mesh.setFrame(input.frame.timeSeconds, input.zoom);
    const organelleSprites = this.organelles.update(draws, input.frame.timeSeconds);
    return { visibleCells: row, organelleSprites };
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
    organelles: output.organelles,
    palette: paletteFor(view.avatarIndex),
    isSprinting: output.terms.isSprinting,
  };
}
