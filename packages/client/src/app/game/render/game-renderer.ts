// The renderer (docs/RENDERING.md §7, docs/ARCHITECTURE.md §6): owns the camera state, the
// layers and the stage timer, and turns one `RenderFrame` into one Pixi render. The seven stages
// it brackets are the `renderStagesMs` keys; the HUD crossings (`previewTraitId`,
// `reticleVisible` in, `cameraExtent` out) are the only things it exchanges with anything else.

import { MILLISECONDS_PER_SECOND, RENDER_STAGE, type Clock, type TraitId } from '@evolution/shared';
import { Sprite } from 'pixi.js';
import type { RenderFrame } from '../net/world-store';
import { RenderStageTimer } from './bench/render-stage-timer';
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
} from './camera';
import { CellLayer } from './cells/cell-layer';
import { DishLayer } from './dish/dish-layer';
import { EffectsLayer } from './effects/effects-layer';
import { Reticle } from './effects/reticle';
import { FoodLayer } from './food/food-layer';
import { applyCameraTransform, createSceneLayers, type SceneLayers } from './layers';
import { followTarget } from './render-target';
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
}

const HALF = 0.5;

export class GameRenderer {
  readonly timer: RenderStageTimer;
  private readonly layers: SceneLayers;
  private readonly dish: DishLayer;
  private readonly food: FoodLayer;
  private readonly cells: CellLayer;
  private readonly effects: EffectsLayer;
  private readonly reticle: Reticle;
  private readonly vignette: Sprite;
  private camera: CameraState | null = null;
  private lastTimeSeconds: number | null = null;
  /** A fixed px-per-wu the bench route asks for; `null` follows the mass-driven zoom. */
  private fixedZoom: number | null = null;

  constructor(
    stage: Parameters<typeof createSceneLayers>[0],
    private readonly textures: RenderTextures,
    clock: Clock,
    private viewport: ViewportPx,
  ) {
    this.timer = new RenderStageTimer(clock);
    this.layers = createSceneLayers(stage);
    this.dish = new DishLayer(textures.dish, textures.glowTexture, textures.cosmetic);
    this.food = new FoodLayer(textures.motes);
    this.cells = new CellLayer(
      { strip: textures.stripTexture, tile: textures.tileTexture, palette: textures.paletteTexture },
      textures.organelles,
      textures.strip,
      textures.seed,
    );
    this.effects = new EffectsLayer(textures.glow);
    this.reticle = new Reticle(textures.ringTexture);
    this.vignette = new Sprite(textures.vignetteTexture);
    this.layers.dish.addChild(this.dish.container);
    this.layers.food.addChild(this.food.container);
    this.layers.cells.addChild(this.cells.container);
    this.layers.depthNear.addChild(this.dish.nearContainer);
    this.layers.effects.addChild(this.effects.container, this.reticle.container);
    this.layers.screen.addChild(this.vignette);
    this.resize(viewport);
  }

  get seed(): number {
    return this.textures.seed;
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

  /** Holds the camera at `zoom` px per wu (the bench route's `zoom=`); `null` releases it. */
  setFixedZoom(zoom: number | null): void {
    this.fixedZoom = zoom;
  }

  private withFixedZoom(camera: CameraState): CameraState {
    if (this.fixedZoom === null) return camera;
    return { ...camera, viewHalfHeightWu: (this.viewport.height * HALF) / this.fixedZoom };
  }

  /** The world point under a screen point, through the current camera. */
  screenToWorld(x: number, y: number): { x: number; y: number } {
    const camera = this.camera ?? parkCamera({ x: 0, y: 0, radius: 1 });
    return screenToWorld(camera, this.viewport, x, y);
  }

  private stepCamera(frame: RenderFrame, ownPlayerId: string | null): CameraState {
    const target = followTarget(frame, ownPlayerId);
    const deltaSeconds = this.lastTimeSeconds === null ? 0 : Math.max(0, frame.timeSeconds - this.lastTimeSeconds);
    this.lastTimeSeconds = frame.timeSeconds;
    if (this.camera === null) return this.withFixedZoom(parkCamera(target ?? { x: 0, y: 0, radius: 1 }));
    return this.withFixedZoom(stepCamera(this.camera, target, deltaSeconds));
  }

  /** One frame: the seven stages, then the outputs the HUD reads. `nowMs` is the clip clock, the frame's time in ms. */
  render(frame: RenderFrame, ownPlayerId: string | null, inputs: RenderInputs, submit: () => void): RenderOutputs {
    const timer = this.timer;
    timer.beginFrame();
    const camera = timer.measure(RENDER_STAGE.camera, () => this.stepCamera(frame, ownPlayerId));
    this.camera = camera;
    const zoom = zoomFor(camera, this.viewport);
    const extent = cameraExtent(camera, this.viewport);
    applyCameraTransform(this.layers.world, camera, this.viewport);
    const nowMs = frame.timeSeconds * MILLISECONDS_PER_SECOND;
    const ownCell = ownPlayerId === null ? null : (frame.cells.find((cell) => cell.playerId === ownPlayerId) ?? null);
    timer.measure(RENDER_STAGE.food, () => this.dish.update({ timeSeconds: frame.timeSeconds, camera }));
    const food = timer.measure(RENDER_STAGE.food, () =>
      this.food.update({ motes: frame.motes, fragments: frame.fragments, timeSeconds: frame.timeSeconds, zoom }),
    );
    const cells = timer.measure(RENDER_STAGE.cells, () =>
      this.cells.update({ frame, extent, zoom, nowMs, ownCell, previewTraitId: inputs.previewTraitId }),
    );
    timer.measure(RENDER_STAGE.effects, () => {
      this.effects.update({ effects: frame.effects, cells: frame.cells, nowMs });
      this.reticle.update({ ...inputs.reticle, zoom });
    });
    timer.measure(RENDER_STAGE.submit, submit);
    timer.endFrame();
    return { cameraExtent: extent, zoom, visibleCells: cells.visibleCells, visibleMotes: food.visibleMotes };
  }

  destroy(): void {
    this.cells.destroy();
    this.food.destroy();
    this.dish.destroy();
    this.effects.destroy();
    this.layers.world.destroy({ children: true });
    this.layers.screen.destroy({ children: true });
  }
}
