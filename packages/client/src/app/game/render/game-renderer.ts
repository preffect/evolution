// The renderer (docs/RENDERING.md §7, docs/ARCHITECTURE.md §6): owns the camera state and the
// layers and turns one `RenderFrame` into one Pixi render. The HUD crossings (`previewTraitId`,
// `reticle` in, `cameraExtent` out) are the only things it exchanges with anything else. The
// stages run in the §7 order (camera, dish, food, cells, effects, submit); slice D (#208) brackets
// them with the stage timer that feeds `renderStagesMs`.

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
} from './camera';
import { DishLayer } from './dish/dish-layer';
import { applyCameraTransform, createSceneLayers, type SceneLayers } from './layers';
import { PlaceholderCellLayer } from './placeholder-cell-layer';
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
/** No food layer yet: slice C (#207) counts the motes it uploads. */
const NO_FOOD_LAYER_MOTES = 0;

export class GameRenderer {
  private readonly layers: SceneLayers;
  private readonly dish: DishLayer;
  /** Slice B (#206) replaces this with `cells/cell-layer.ts`. */
  private readonly cells: PlaceholderCellLayer;
  // Slice C (#207) adds the food layer, the effects layer and the reticle here, in `layers.food`
  // and `layers.effects`; `inputs.reticle` is carried for it.
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
    this.dish = new DishLayer(textures.glowTexture, textures.cosmetic);
    this.cells = new PlaceholderCellLayer();
    this.vignette = new Sprite(textures.vignetteTexture);
    this.layers.dish.addChild(this.dish.container);
    this.layers.cells.addChild(this.cells.container);
    this.layers.depthNear.addChild(this.dish.nearContainer);
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

  /** Holds the camera at `zoom` px per wu; `null` releases it. */
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

  /** One frame: the stages in order, then the outputs the HUD reads. */
  render(frame: RenderFrame, ownPlayerId: string | null, inputs: RenderInputs, submit: () => void): RenderOutputs {
    const camera = this.stepCamera(frame, ownPlayerId);
    this.camera = camera;
    const zoom = zoomFor(camera, this.viewport);
    const extent = cameraExtent(camera, this.viewport);
    applyCameraTransform(this.layers.world, camera, this.viewport);
    const nowMs = frame.timeSeconds * MILLISECONDS_PER_SECOND;
    const ownCell = ownPlayerId === null ? null : (frame.cells.find((cell) => cell.playerId === ownPlayerId) ?? null);
    this.dish.update({ timeSeconds: frame.timeSeconds, camera });
    const cells = this.cells.update({ frame, extent, zoom, nowMs, ownCell, previewTraitId: inputs.previewTraitId });
    submit();
    return { cameraExtent: extent, zoom, visibleCells: cells.visibleCells, visibleMotes: NO_FOOD_LAYER_MOTES };
  }

  destroy(): void {
    this.cells.destroy();
    this.dish.destroy();
    this.layers.world.destroy({ children: true });
    this.layers.screen.destroy({ children: true });
  }
}
