// The one renderer a session holds (docs/rendering/budget.md §7): built over a texture bundle for a
// seed, disposed together with it, replaced when the seed changes. Both sessions (a live room, the
// bench route) keep theirs here so the build / dispose order is written once.
//
// The bundle's seed-independent half (`SharedRenderTextures`: the fonts, the atlases, the radial bakes)
// is baked on the first build and **kept**: a rematch re-bakes only what its seed decides (ticket #442,
// docs/rendering/budget.md §7.2). It is dropped only by `dispose`, or when a build arrives on a different
// baker or device pixel ratio — the two inputs it was baked from.
//
// A build can also be **staged** (ticket #479): `beginBuild` hands back a `RendererBuild` whose bakes the caller
// runs one per frame, while the previous renderer (a rematch's) keeps drawing; the swap happens on the last step.
// `build` is the same steps run back to back, for the bench and the preview, which measure a whole build.

import type { Container } from 'pixi.js';
import type { StageMeasurer } from './bench/render-stage-timer';
import type { ViewportPx } from './camera';
import { GameRenderer } from './game-renderer';
import { stageSeededRenderTextures, stageSharedRenderTextures } from './render-texture-stages';
import {
  destroySeededRenderTextures,
  destroySharedRenderTextures,
  type RenderTextureOptions,
  type SeededRenderTextures,
  type SharedRenderTextures,
  type TextureBaker,
} from './render-textures';
import type { StagedBake } from './staged-bake';

/** The kept half, with the two inputs it was baked from: a build that changes either re-bakes it. */
interface SharedBundle {
  readonly textures: SharedRenderTextures;
  readonly baker: TextureBaker;
  readonly devicePixelRatio: number;
}

/** A renderer being built a step at a time; the slot swaps it in on the last step. */
export interface RendererBuild {
  /** Runs the next bake; on the last one the new renderer replaces the old and this answers it. */
  advance(): GameRenderer | null;
  /** Runs every bake left and swaps the renderer in: for a caller that cannot wait (a teardown mid-build). */
  finish(): GameRenderer;
}

export class RendererSlot {
  private shared: SharedBundle | null = null;
  private seeded: SeededRenderTextures | null = null;
  private renderer: GameRenderer | null = null;

  get current(): GameRenderer | null {
    return this.renderer;
  }

  /** Builds a renderer on `stage` over textures baked from `options`, disposing the previous one: all at once. */
  build(stage: Container, viewport: ViewportPx, options: RenderTextureOptions, stages: StageMeasurer): GameRenderer {
    return this.beginBuild(stage, viewport, options, stages).finish();
  }

  /**
   * The same build, a step at a time: the shared half's bakes (only when it is not already kept for this baker and
   * pixel ratio), then the seeded half's. Nothing is swapped until the last step, so the current renderer keeps
   * drawing meanwhile; one build at a time (a session queues the next behind this one).
   */
  beginBuild(
    stage: Container,
    viewport: ViewportPx,
    options: RenderTextureOptions,
    stages: StageMeasurer,
  ): RendererBuild {
    const { baker, devicePixelRatio } = options;
    const kept = this.shared;
    const isKept = kept !== null && kept.baker === baker && kept.devicePixelRatio === devicePixelRatio;
    const shared = isKept ? null : stageSharedRenderTextures(baker, devicePixelRatio);
    const seeded = stageSeededRenderTextures(options);
    const bakes: StagedBake<unknown>[] = shared === null ? [seeded] : [shared, seeded];
    const swapIn = (): GameRenderer => {
      this.disposeSeeded();
      if (shared !== null) this.replaceShared(shared.result(), baker, devicePixelRatio);
      this.seeded = seeded.result();
      this.renderer = new GameRenderer(stage, { ...this.sharedTextures(), ...this.seeded }, viewport, stages);
      return this.renderer;
    };
    return {
      advance: () => {
        bakes.find((bake) => !bake.isDone)?.runNext();
        return bakes.every((bake) => bake.isDone) ? swapIn() : null;
      },
      finish: () => {
        for (const bake of bakes) bake.runAll();
        return swapIn();
      },
    };
  }

  dispose(): void {
    this.disposeSeeded();
    if (this.shared !== null) destroySharedRenderTextures(this.shared.textures);
    this.shared = null;
  }

  /** The kept half a new bake replaces, dropping the old one (its renderer is already gone). */
  private replaceShared(textures: SharedRenderTextures, baker: TextureBaker, devicePixelRatio: number): void {
    const kept = this.shared;
    this.shared = { textures, baker, devicePixelRatio };
    if (kept !== null) destroySharedRenderTextures(kept.textures);
  }

  private sharedTextures(): SharedRenderTextures {
    if (this.shared === null) throw new Error('A renderer was swapped in with no shared texture half.');
    return this.shared.textures;
  }

  /** The renderer and the seeded half: what a rebuild replaces. */
  private disposeSeeded(): void {
    this.renderer?.destroy();
    this.renderer = null;
    if (this.seeded !== null) destroySeededRenderTextures(this.seeded);
    this.seeded = null;
  }
}
