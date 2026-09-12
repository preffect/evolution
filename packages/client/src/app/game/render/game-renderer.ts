// The renderer (docs/RENDERING.md §7, docs/ARCHITECTURE.md §6): owns the camera state and the
// layers and turns one `RenderFrame` into one Pixi render. The HUD crossings (`previewTraitId`,
// `reticle` in, `cameraExtent` out) are the only things it exchanges with anything else. The
// stages run in the §7 order (camera, food, cells with organelles inside, effects, submit), each
// bracketed by the injected `StageMeasurer` that feeds `renderStagesMs` (`net` is the session's).
// The effects arrive once, in the frame whose render tick reached them: the effects layer and the
// clip tracker both start from them before the cell layer syncs, so a prey that just left the
// frame still resolves to its last view; that start is accrued to the `effects` stage.

import { MILLISECONDS_PER_SECOND, RENDER_STAGE, type TraitId } from '@evolution/shared';
import { Sprite, type Container } from 'pixi.js';
import type { RenderFrame } from '../net/world-store';
import { UNTIMED_STAGES, type StageMeasurer } from './bench/render-stage-timer';
import {
  cameraExtent,
  parkCamera,
  screenToWorld,
  stepCamera,
  zoomFor,
  type CameraExtent,
  type CameraState,
  type CameraTarget,
  type ViewportPx,
  type WorldPoint,
} from './camera';
import { cellClipStarts, type LastViewOf } from './cells/cell-effects';
import { CellLayer } from './cells/cell-layer';
import { DishLayer } from './dish/dish-layer';
import { CellClipTracker, cellsById, type CellViewsById } from './effects/cell-clip-tracker';
import { EffectsLayer } from './effects/effects-layer';
import { FoodLayer } from './food/food-layer';
import { HALF } from './geometry';
import { applyCameraTransform, createSceneLayers, type SceneLayers } from './layers';
import { DISH_CENTRE_TARGET, followTarget, ownCellOf } from './render-target';
import type { RenderTextures } from './render-textures';

export interface RenderInputs {
  readonly previewTraitId: TraitId | null;
  readonly reticle: { readonly isVisible: boolean; readonly x: number; readonly y: number };
}

export interface RenderOutputs {
  readonly cameraExtent: CameraExtent;
  readonly zoom: number;
  readonly visibleCells: number;
  readonly visibleMotes: number;
  readonly fragments: number;
  /** Effect and reticle sprites placed this frame (docs/RENDERING.md §6). */
  readonly effectSprites: number;
}

/** No reticle this frame: the pointer has not been over the canvas, or the HUD hides it (docs/UI.md §5). */
export const NO_RETICLE: RenderInputs['reticle'] = { isVisible: false, x: 0, y: 0 };

export class GameRenderer {
  private readonly layers: SceneLayers;
  private readonly dish: DishLayer;
  private readonly food: FoodLayer;
  private readonly cells: CellLayer;
  private readonly effects: EffectsLayer;
  private readonly clips = new CellClipTracker();
  private readonly vignette: Sprite;
  private camera: CameraState | null = null;
  private lastTimeSeconds: number | null = null;
  /** A fixed px-per-wu the bench route (slice D) asks for; `null` follows the mass-driven zoom. */
  private fixedZoom: number | null = null;

  constructor(
    stage: Container,
    private readonly textures: RenderTextures,
    private viewport: ViewportPx,
    private readonly stages: StageMeasurer = UNTIMED_STAGES,
  ) {
    this.layers = createSceneLayers(stage);
    this.dish = new DishLayer(textures);
    this.food = new FoodLayer(textures);
    this.cells = new CellLayer(textures, undefined, stages);
    this.effects = new EffectsLayer(textures);
    this.vignette = new Sprite(textures.vignetteTexture);
    this.layers.dish.addChild(this.dish.container);
    this.layers.food.addChild(this.food.container);
    this.layers.fragments.addChild(this.food.fragmentContainer);
    this.layers.cells.addChild(this.cells.container);
    this.layers.depthNear.addChild(this.dish.nearContainer);
    this.layers.effects.addChild(this.effects.container);
    this.layers.screen.addChild(this.vignette);
    this.resize(viewport);
  }

  get seed(): number {
    return this.textures.seed;
  }

  /** The cell layer's packed rows, read-only: a test or the bench reads what the clips did to a cell. */
  get cellInstances(): Readonly<Float32Array> {
    return this.cells.instances;
  }

  resize(viewport: ViewportPx): void {
    this.viewport = viewport;
    this.vignette.width = viewport.width;
    this.vignette.height = viewport.height;
  }

  /** Parks the camera on a target (a fixture or a spawn) without smoothing. */
  parkOn(target: CameraTarget): void {
    this.camera = this.withFixedZoom(parkCamera(target));
  }

  /** Holds the camera at `zoom` px per wu; `null` releases it. */
  setFixedZoom(zoom: number | null): void {
    this.fixedZoom = zoom;
  }

  private withFixedZoom(camera: CameraState): CameraState {
    if (this.fixedZoom === null) return camera;
    return { ...camera, viewHalfHeightWu: (this.viewport.height * HALF) / this.fixedZoom };
  }

  /** The world point under a screen point, through the current camera. */
  screenToWorld(x: number, y: number): WorldPoint {
    const camera = this.camera ?? parkCamera(DISH_CENTRE_TARGET);
    return screenToWorld(camera, this.viewport, x, y);
  }

  private stepCamera(frame: RenderFrame, ownPlayerId: string | null): CameraState {
    const target = followTarget(frame, ownPlayerId);
    const deltaSeconds = this.lastTimeSeconds === null ? 0 : Math.max(0, frame.timeSeconds - this.lastTimeSeconds);
    this.lastTimeSeconds = frame.timeSeconds;
    if (this.camera === null) return this.withFixedZoom(parkCamera(target ?? DISH_CENTRE_TARGET));
    return this.withFixedZoom(stepCamera(this.camera, target, deltaSeconds));
  }

  /** This frame's view of a cell, or the one it was last drawn with (a prey on its payout frame). */
  private viewLookup(views: CellViewsById): LastViewOf {
    return (cellId) => views.get(cellId) ?? this.cells.lastViewOf(cellId);
  }

  /** The camera stage exactly as §7 defines it: follow, zoom, cull, `cameraExtent` — the dish is not in it. */
  private cameraStage(
    frame: RenderFrame,
    ownPlayerId: string | null,
  ): { camera: CameraState; zoom: number; extent: CameraExtent } {
    const camera = this.stepCamera(frame, ownPlayerId);
    this.camera = camera;
    applyCameraTransform(this.layers.world, camera, this.viewport);
    return { camera, zoom: zoomFor(camera, this.viewport), extent: cameraExtent(camera, this.viewport) };
  }

  /** The cell views every later stage reads, charged to the `cells` stage that consumes them (§7). */
  private cellViews(
    frame: RenderFrame,
    ownPlayerId: string | null,
  ): { ownCell: ReturnType<typeof ownCellOf>; views: CellViewsById; viewOf: LastViewOf } {
    const views = cellsById(frame.cells);
    return { ownCell: ownCellOf(frame, ownPlayerId), views, viewOf: this.viewLookup(views) };
  }

  /** One frame: the stages in order, then the outputs the HUD reads. */
  render(frame: RenderFrame, ownPlayerId: string | null, inputs: RenderInputs, submit: () => void): RenderOutputs {
    const { stages } = this;
    const { camera, zoom, extent } = stages.measure(RENDER_STAGE.camera, () => this.cameraStage(frame, ownPlayerId));
    // The depth-particle walk and the light-pool placement are neither the camera nor a stage of their own
    // (§7): they land in the frame's unbracketed residual, which the HUD budget row judges.
    this.dish.update({ timeSeconds: frame.timeSeconds, camera, viewport: this.viewport });
    const nowMs = frame.timeSeconds * MILLISECONDS_PER_SECOND;
    const { ownCell, views, viewOf } = stages.accrue(RENDER_STAGE.cells, () => this.cellViews(frame, ownPlayerId));
    const deformations = stages.accrue(RENDER_STAGE.effects, () => {
      this.effects.start(frame.effects, viewOf, nowMs);
      this.clips.start(cellClipStarts(frame.effects, viewOf), nowMs);
      return this.clips.deformations(frame.cells, nowMs, views);
    });
    const food = stages.measure(RENDER_STAGE.food, () =>
      this.food.update({ motes: frame.motes, fragments: frame.fragments, timeSeconds: frame.timeSeconds, zoom }),
    );
    const cells = stages.measure(RENDER_STAGE.cells, () =>
      this.cells.update({ frame, extent, zoom, nowMs, ownCell, previewTraitId: inputs.previewTraitId, deformations }),
    );
    const effects = stages.measure(RENDER_STAGE.effects, () =>
      this.effects.update({ viewOf, nowMs, reticle: { ...inputs.reticle, zoom, ownCell } }),
    );
    stages.measure(RENDER_STAGE.submit, submit);
    return {
      cameraExtent: extent,
      zoom,
      visibleCells: cells.visibleCells,
      visibleMotes: food.motes,
      fragments: food.fragments,
      effectSprites: effects.sprites,
    };
  }

  destroy(): void {
    this.clips.clear();
    this.effects.destroy();
    this.cells.destroy();
    this.food.destroy();
    this.dish.destroy();
    this.layers.world.destroy({ children: true });
    this.layers.screen.destroy({ children: true });
  }
}
