// The one renderer a session holds (docs/RENDERING.md §7): built over a fresh texture bundle for a
// seed, disposed together with it, replaced when the seed changes. Both sessions (a live room, the
// bench route) keep theirs here so the build / dispose order is written once.

import type { Container } from 'pixi.js';
import type { StageMeasurer } from './bench/render-stage-timer';
import type { ViewportPx } from './camera';
import { GameRenderer } from './game-renderer';
import {
  createRenderTextures,
  destroyRenderTextures,
  type RenderTextureOptions,
  type RenderTextures,
} from './render-textures';

export class RendererSlot {
  private textures: RenderTextures | null = null;
  private renderer: GameRenderer | null = null;

  get current(): GameRenderer | null {
    return this.renderer;
  }

  /** Builds a renderer on `stage` over textures baked from `options`, disposing the previous one first. */
  build(stage: Container, viewport: ViewportPx, options: RenderTextureOptions, stages: StageMeasurer): GameRenderer {
    this.dispose();
    this.textures = createRenderTextures(options);
    this.renderer = new GameRenderer(stage, this.textures, viewport, stages);
    return this.renderer;
  }

  dispose(): void {
    this.renderer?.destroy();
    this.renderer = null;
    if (this.textures !== null) destroyRenderTextures(this.textures);
    this.textures = null;
  }
}
