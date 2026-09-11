// The cell layer (docs/RENDERING.md §2, §3, §6): one render state per visible cell, the ghosts
// of absorbed prey, the contact dents, the instance rows packed radius-ascending into the mesh,
// the organelle sprites and the flagella. It composes; every decision lives in the pure modules
// it calls. Culling is against the camera extent the orchestrator passes in.

import {
  EFFECT_KIND,
  createSeededRandom,
  type CellView,
  type EntityId,
  type RandomSource,
  type TraitId,
} from '@evolution/shared';
import { Container } from 'pixi.js';
import type { RenderFrame } from '../../net/world-store';
import { isDiscInExtent, type CameraExtent } from '../camera';
import { CELL_QUAD_EXTENT_RADII } from '../constants';
import { paletteFor } from '../palette';
import type { NoiseStrip } from '../noise/noise-strip';
import type { OrganelleAtlas } from '../textures/organelle-atlas';
import { ViewRegistry } from '../view-registry';
import { packCellInstance } from './cell-instance';
import { CellMesh, type CellMeshTextures } from './cell-mesh';
import { CellRenderState, type CellFrameContext, type CellFrameOutput } from './cell-render-state';
import { computeContactDents } from './contact-dents';
import { applyCellEffects } from './cell-effects';
import { FlagellumLines, type FlagellumSpec } from './flagellum-lines';
import { GhostRegistry } from './ghost-cells';
import { ghostInstance } from './ghost-instance';
import { OrganelleSprites, type OrganelleDraw } from './organelle-sprites';

export interface CellLayerFrame {
  readonly frame: RenderFrame;
  readonly extent: CameraExtent;
  readonly zoom: number;
  readonly nowMs: number;
  readonly ownCell: CellView | null;
  readonly previewTraitId: TraitId | null;
}

export interface CellLayerStats {
  readonly visibleCells: number;
  readonly organelleSprites: number;
}

export class CellLayer {
  readonly container = new Container();
  private readonly mesh: CellMesh;
  private readonly organelles: OrganelleSprites;
  private readonly flagella = new FlagellumLines();
  private readonly ghosts = new GhostRegistry();
  private readonly registry: ViewRegistry<CellView, CellRenderState>;
  private readonly roundRandom: RandomSource;

  constructor(
    textures: CellMeshTextures,
    atlas: OrganelleAtlas,
    private readonly strip: NoiseStrip,
    seed: number,
  ) {
    this.roundRandom = createSeededRandom(seed);
    this.registry = new ViewRegistry({
      create: (view) => new CellRenderState(view.id, this.roundRandom),
      destroy: () => undefined,
    });
    this.mesh = new CellMesh(textures);
    this.organelles = new OrganelleSprites(atlas);
    this.container.addChild(
      this.mesh.bodyPass,
      this.organelles.container,
      this.flagella.graphics,
      this.mesh.membranePass,
    );
  }

  private visibleCells(cells: readonly CellView[], extent: CameraExtent): CellView[] {
    return cells
      .filter((cell) => isDiscInExtent(extent, cell.x, cell.y, cell.radius * CELL_QUAD_EXTENT_RADII))
      .sort((first, second) => first.radius - second.radius);
  }

  private preyProgress(cells: readonly CellView[]): Map<EntityId, number> {
    const byPredator = new Map<EntityId, number>();
    for (const cell of cells) {
      if (cell.engulfedByCellId !== null) byPredator.set(cell.engulfedByCellId, cell.engulfProgress);
    }
    return byPredator;
  }

  private preyAngles(cells: readonly CellView[]): void {
    const byId = new Map(cells.map((cell) => [cell.id, cell]));
    for (const cell of cells) {
      const state = this.registry.get(cell.id);
      const prey = cell.engulfingCellId === null ? undefined : byId.get(cell.engulfingCellId);
      if (state !== undefined)
        state.angles.preyAngle = prey === undefined ? null : Math.atan2(prey.y - cell.y, prey.x - cell.x);
    }
  }

  private frameContext(
    input: CellLayerFrame,
    sealByPredator: Map<EntityId, number>,
    cells: readonly CellView[],
  ): Omit<CellFrameContext, 'contactDent'> {
    const balance = input.frame.balance;
    return {
      timeSeconds: input.frame.timeSeconds,
      nowMs: input.nowMs,
      zoom: input.zoom,
      balance,
      ownCell: input.ownCell,
      strip: this.strip,
      previewTraitId: input.previewTraitId,
      absorbedSealByPredator: sealByPredator,
      preyProgressByPredator: this.preyProgress(cells),
    };
  }

  /** One frame: effects, cull, sort, update every state, pack the rows and place the sprites. */
  update(input: CellLayerFrame): CellLayerStats {
    const { frame } = input;
    const visible = this.visibleCells(frame.cells, input.extent);
    const sync = this.registry.sync(visible);
    applyCellEffects(frame.effects, this.registry, this.ghosts, input.nowMs);
    this.preyAngles(visible);
    const ghosts = this.ghosts.active(input.nowMs);
    const dents = computeContactDents(visible);
    const context = this.frameContext(input, this.ghosts.sealByPredator(ghosts), visible);
    const outputs: CellFrameOutput[] = [];
    let row = 0;
    for (const [view, state] of sync.pairs) {
      const output = state.update(view, { ...context, contactDent: dents.get(view.id) ?? null });
      outputs.push(output);
      packCellInstance(this.mesh.instances, row, output.instance);
      row += 1;
    }
    for (const ghost of ghosts) {
      if (row >= this.mesh.capacity) break;
      packCellInstance(this.mesh.instances, row, ghostInstance(ghost, input.zoom));
      row += 1;
    }
    this.mesh.setCount(row);
    this.mesh.upload();
    this.mesh.setFrame(frame.timeSeconds, input.zoom);
    const organelleSprites = this.organelles.update(this.organelleDraws(sync.pairs, outputs), frame.timeSeconds);
    this.flagella.update(this.flagellumSpecs(sync.pairs, outputs, frame.timeSeconds), input.zoom);
    return { visibleCells: visible.length, organelleSprites };
  }

  private organelleDraws(
    pairs: readonly (readonly [CellView, CellRenderState])[],
    outputs: readonly CellFrameOutput[],
  ): OrganelleDraw[] {
    return outputs.map((output, index) => ({
      instance: output.instance,
      organelles: output.organelles,
      palette: paletteFor(pairs[index]![0].avatarIndex),
      isSprinting: pairs[index]![0].sprintRemainingTicks > 0,
    }));
  }

  private flagellumSpecs(
    pairs: readonly (readonly [CellView, CellRenderState])[],
    outputs: readonly CellFrameOutput[],
    timeSeconds: number,
  ): FlagellumSpec[] {
    const specs: FlagellumSpec[] = [];
    outputs.forEach((output, index) => {
      const tier = output.traits.tierOf('simple_flagellum');
      if (tier === 0 || output.lod.isFarDot) return;
      const view = pairs[index]![0];
      specs.push({
        x: view.x,
        y: view.y,
        radius: view.radius * output.instance.pulse,
        heading: output.instance.heading,
        tier,
        timeSeconds,
        isSprinting: view.sprintRemainingTicks > 0,
        phase: output.instance.stripPhase,
      });
    });
    return specs;
  }

  /** Every effect kind the layer listens to, for the orchestrator's stage bookkeeping. */
  static readonly EFFECT_KINDS = [
    EFFECT_KIND.eat,
    EFFECT_KIND.levelUp,
    EFFECT_KIND.respawn,
    EFFECT_KIND.cellAbsorbed,
  ] as const;

  destroy(): void {
    this.registry.clear();
    this.ghosts.clear();
    this.mesh.destroy();
    this.organelles.destroy();
    this.flagella.destroy();
    this.container.destroy();
  }
}
