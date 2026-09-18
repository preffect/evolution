// The one renderer a session holds (docs/rendering/budget.md §7): built over a texture bundle for a
// seed, disposed together with it, replaced when the seed changes. Both sessions (a live room, the
// bench route) keep theirs here so the build / dispose order is written once.
//
// The bundle's seed-independent half (`SharedRenderTextures`: the fonts, the atlases, the radial bakes)
// is baked on the first build and **kept**: a rematch re-bakes only what its seed decides (ticket #442,
// docs/rendering/budget.md §7.2). It is dropped only by `dispose`, or when a build arrives on a different
// baker or device pixel ratio — the two inputs it was baked from.

import type { Container } from 'pixi.js';
import type { StageMeasurer } from './bench/render-stage-timer';
import type { ViewportPx } from './camera';
import { GameRenderer } from './game-renderer';
import {
  createSeededRenderTextures,
  createSharedRenderTextures,
  destroySeededRenderTextures,
  destroySharedRenderTextures,
  type RenderTextureOptions,
  type SeededRenderTextures,
  type SharedRenderTextures,
  type TextureBaker,
} from './render-textures';

/** The kept half, with the two inputs it was baked from: a build that changes either re-bakes it. */
interface SharedBundle {
  readonly textures: SharedRenderTextures;
  readonly baker: TextureBaker;
  readonly devicePixelRatio: number;
}

export class RendererSlot {
  private shared: SharedBundle | null = null;
  private seeded: SeededRenderTextures | null = null;
  private renderer: GameRenderer | null = null;

  get current(): GameRenderer | null {
    return this.renderer;
  }

  /** Builds a renderer on `stage` over textures baked from `options`, disposing the previous one first. */
  build(stage: Container, viewport: ViewportPx, options: RenderTextureOptions, stages: StageMeasurer): GameRenderer {
    this.disposeSeeded();
    const shared = this.sharedFor(options.baker, options.devicePixelRatio);
    this.seeded = createSeededRenderTextures(options);
    this.renderer = new GameRenderer(stage, { ...shared, ...this.seeded }, viewport, stages);
    return this.renderer;
  }

  dispose(): void {
    this.disposeSeeded();
    if (this.shared !== null) destroySharedRenderTextures(this.shared.textures);
    this.shared = null;
  }

  /** The kept half, baked on the first build and re-baked only when its inputs change. */
  private sharedFor(baker: TextureBaker, devicePixelRatio: number): SharedRenderTextures {
    const kept = this.shared;
    if (kept !== null && kept.baker === baker && kept.devicePixelRatio === devicePixelRatio) return kept.textures;
    // Emptied before the destroy, never after: a bake that throws must leave the slot with nothing rather
    // than with a destroyed bundle the next same-baker build would hand straight to a new renderer.
    this.shared = null;
    if (kept !== null) destroySharedRenderTextures(kept.textures);
    const textures = createSharedRenderTextures(baker, devicePixelRatio);
    this.shared = { textures, baker, devicePixelRatio };
    return textures;
  }

  /** The renderer and the seeded half: what a rebuild replaces. */
  private disposeSeeded(): void {
    this.renderer?.destroy();
    this.renderer = null;
    if (this.seeded !== null) destroySeededRenderTextures(this.seeded);
    this.seeded = null;
  }
}
