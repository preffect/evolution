// The renderer (docs/RENDERING.md §7, docs/ARCHITECTURE.md §6): owns the camera state and the
// layers and turns one `RenderFrame` into one Pixi render. The HUD crossings (`previewTraitId`,
// `reticle` in, `cameraExtent` out) are the only things it exchanges with anything else. The
// stages run in the §7 order (camera, dish, food, cells, effects, submit); slice D (#208) brackets
// them with the stage timer that feeds `renderStagesMs`. The effects arrive once, in the frame
// whose render tick reached them: the effects layer and the clip tracker both start from them
// before the cell layer syncs, so a prey that just left the frame still resolves to its last view.

import { MILLISECONDS_PER_SECOND, type TraitId } from '@evolution/shared';
import { Sprite, type Container } from 'pixi.js';
import type { RenderFrame } from '../net/world-store';
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

/** The HUD's reticle while #100 has not wired the pointer: hidden. */
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
  ) {
    this.layers = createSceneLayers(stage);
    this.dish = new DishLayer(textures);
    this.food = new FoodLayer(textures);
    this.cells = new CellLayer(textures);
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

  /** One frame: the stages in order, then the outputs the HUD reads. */
  render(frame: RenderFrame, ownPlayerId: string | null, inputs: RenderInputs, submit: () => void): RenderOutputs {
    const camera = this.stepCamera(frame, ownPlayerId);
    this.camera = camera;
    const zoom = zoomFor(camera, this.viewport);
    const extent = cameraExtent(camera, this.viewport);
    applyCameraTransform(this.layers.world, camera, this.viewport);
    const nowMs = frame.timeSeconds * MILLISECONDS_PER_SECOND;
    const ownCell = ownCellOf(frame, ownPlayerId);
    const views = cellsById(frame.cells);
    const viewOf = this.viewLookup(views);
    this.effects.start(frame.effects, viewOf, nowMs);
    this.clips.start(cellClipStarts(frame.effects, viewOf), nowMs);
    this.dish.update({ timeSeconds: frame.timeSeconds, camera, viewport: this.viewport });
    const food = this.food.update({
      motes: frame.motes,
      fragments: frame.fragments,
      timeSeconds: frame.timeSeconds,
      zoom,
    });
    const cells = this.cells.update({
      frame,
      extent,
      zoom,
      nowMs,
      ownCell,
      previewTraitId: inputs.previewTraitId,
      deformations: this.clips.deformations(frame.cells, nowMs, views),
    });
    const effects = this.effects.update({ viewOf, nowMs, reticle: { ...inputs.reticle, zoom, ownCell } });
    submit();
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
