// The cell layer (docs/RENDERING.md §2, §3, §6): one render state per cell in the frame (kept
// while the cell is off screen, so its slots and held heading survive a cull), the ghosts of
// absorbed prey, the contact dents of the visible cells, the visible ones packed radius-ascending
// into the mesh, the organelle sprites between the two passes and the flagella under the body.
// It composes; every decision lives in the pure modules it calls. Culling is against the camera
// extent the orchestrator passes in, at the quad's reach; past the capacity the smallest cells
// are the ones dropped, and the ghosts take the rows the living cells leave.

import type { CellView, EntityId } from '@evolution/shared';
import { Container } from 'pixi.js';
import { isDiscInExtent, type CameraExtent } from '../camera';
import { CELL_INSTANCE_CAPACITY, CELL_QUAD_EXTENT_RADII } from '../constants';
import { paletteFor } from '../palette';
import type { RenderTextures } from '../render-textures';
import { ViewRegistry } from '../view-registry';
import { deformationOf } from './cell-deformation';
import { startAbsorbedGhosts } from './cell-effects';
import { packCellInstance } from './cell-instance';
import type { CellLayerFrame, CellLayerOutputs } from './cell-layer-frame';
import { CellMesh } from './cell-mesh';
import { CellRenderState, type CellFrameContext, type CellFrameOutput } from './cell-render-state';
import { computeContactDents } from './contact-dents';
import { FlagellumLines, type FlagellumSpec } from './flagellum-lines';
import { GhostRegistry, type Ghost } from './ghost-cells';
import { ghostInstance } from './ghost-instance';
import { OrganelleSprites, type OrganelleDraw } from './organelle-sprites';

export type CellLayerTextures = Pick<
  RenderTextures,
  'cosmetic' | 'strip' | 'stripTexture' | 'tileTexture' | 'paletteTexture' | 'organelles'
>;

const FLAGELLUM_TRAIT = 'simple_flagellum';

export class CellLayer {
  readonly container = new Container();
  private readonly mesh: CellMesh;
  private readonly organelles: OrganelleSprites;
  private readonly flagella = new FlagellumLines();
  private readonly ghosts = new GhostRegistry();
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
    this.container.addChild(
      this.flagella.graphics,
      this.mesh.bodyPass,
      this.organelles.container,
      this.mesh.membranePass,
    );
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

  private frameContext(
    input: CellLayerFrame,
    visible: readonly CellView[],
    ghosts: readonly Ghost[],
  ): CellFrameContext {
    return {
      timeSeconds: input.frame.timeSeconds,
      zoom: input.zoom,
      balance: input.frame.balance,
      ownCell: input.ownCell,
      strip: this.textures.strip,
      previewTraitId: input.previewTraitId,
      contactDents: computeContactDents(visible),
      absorbedSeals: GhostRegistry.sealByPredator(ghosts),
    };
  }

  /** The last view a cell was drawn with: the ghost's source once the entity is gone. */
  private lastViewOf(cellId: EntityId): CellView | undefined {
    return this.registry.get(cellId)?.lastView ?? undefined;
  }

  /** The ghosts still dissolving, packed after the living cells while rows remain. */
  private packGhosts(ghosts: readonly Ghost[], firstRow: number, zoom: number): number {
    let row = firstRow;
    for (const ghost of ghosts) {
      if (row >= this.mesh.capacity) break;
      packCellInstance(this.mesh.instances, row, ghostInstance(ghost, zoom));
      row += 1;
    }
    return row - firstRow;
  }

  /** One frame: effects, sync every state, cull, sort, update the visible ones, pack the rows, place the sprites and tails. */
  update(input: CellLayerFrame): CellLayerOutputs {
    const { frame } = input;
    startAbsorbedGhosts(frame.effects, (id) => this.lastViewOf(id), this.ghosts, input.nowMs);
    this.registry.sync(frame.cells);
    const visible = this.visibleCells(frame.cells, input.extent);
    const ghosts = this.ghosts.active(input.nowMs);
    const context = this.frameContext(input, visible, ghosts);
    const draws: OrganelleDraw[] = [];
    const tails: FlagellumSpec[] = [];
    visible.forEach((view, row) => {
      const state = this.registry.get(view.id);
      if (state === undefined) return;
      const output = state.update(view, context, deformationOf(input.deformations, view.id));
      packCellInstance(this.mesh.instances, row, output.instance);
      draws.push(organelleDraw(view, output));
      const tail = flagellumSpec(view, output, frame.timeSeconds);
      if (tail !== null) tails.push(tail);
    });
    const packedGhosts = this.packGhosts(ghosts, draws.length, input.zoom);
    this.mesh.setCount(draws.length + packedGhosts);
    this.mesh.upload();
    this.mesh.setFrame(frame.timeSeconds, input.zoom);
    const organelleSprites = this.organelles.update(draws, frame.timeSeconds);
    const flagella = this.flagella.update(tails, input.zoom);
    return { visibleCells: draws.length, ghosts: packedGhosts, organelleSprites, flagella };
  }

  destroy(): void {
    this.registry.clear();
    this.ghosts.clear();
    this.mesh.destroy();
    this.organelles.destroy();
    this.flagella.destroy();
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

/** The cell's tail when it owns `simple_flagellum` and is not a far dot (docs/RENDERING.md §3). */
function flagellumSpec(view: CellView, output: CellFrameOutput, timeSeconds: number): FlagellumSpec | null {
  const tier = output.traits.tierOf(FLAGELLUM_TRAIT);
  if (tier === 0 || output.lod.isFarDot) return null;
  return {
    x: view.x,
    y: view.y,
    radius: view.radius * output.instance.pulse,
    heading: output.instance.heading,
    tier,
    timeSeconds,
    isSprinting: output.terms.isSprinting,
    phase: output.instance.stripPhase,
  };
}
