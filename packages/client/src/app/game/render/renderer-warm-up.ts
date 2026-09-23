// Warming a staged renderer's first draw before its reveal (ticket #603, docs/rendering/budget.md §7.2). Ticket #479
// staged the bake, but the first frame a new renderer drew was still the longest task of a room's entry: the
// renderer's first-time CPU work (every pool, mesh and text made on first use) and Pixi's first `render` (every
// texture uploaded, every shader compiled). So after the last bake the build goes on, one step per frame, with the
// new renderer still **off the stage**: its bundle's texture sources uploaded `RENDER_WARM_UP_UPLOADS_PER_FRAME` at a time, one
// warm-up draw of the current frame (its CPU half, muted in the frame instrumentation), and one render of it to an
// off-screen target (the shader compiles). Only then is it committed to the stage, where its first visible frame
// finds everything made, resident and compiled.

import type { RenderStageName } from '@evolution/shared';
import { Texture, TextureSource, type Container } from 'pixi.js';
import type { StageMeasurer } from './bench/render-stage-timer';
import { RENDER_WARM_UP_UPLOADS_PER_FRAME } from './constants';
import type { GameRenderer } from './game-renderer';
import type { RendererBuild } from './renderer-slot';
import type { RenderTextures } from './render-textures';

/** What the warm-up asks of the Pixi app: a texture upload and an off-screen render (`pixi-app.ts`; a fake in tests). */
export interface RendererWarmUpSeam {
  uploadTextureSource(source: TextureSource): void;
  renderOffscreen(container: Container): void;
}

/** Stage brackets that can be muted, so the warm-up draw adds no sample to the frame report (`bench/`). */
export class MutableStageMeasurer implements StageMeasurer {
  isMuted = false;

  constructor(private readonly inner: StageMeasurer) {}

  measure<Result>(stage: RenderStageName, work: () => Result): Result {
    return this.isMuted ? work() : this.inner.measure(stage, work);
  }

  accrue<Result>(stage: RenderStageName, work: () => Result): Result {
    return this.isMuted ? work() : this.inner.accrue(stage, work);
  }
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object') return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === Array.prototype;
}

/** Every texture source a bundle holds, each once: a `Texture`'s source, or a data texture's own. */
export function textureSourcesOf(textures: RenderTextures): TextureSource[] {
  const found = new Set<TextureSource>();
  const visit = (value: unknown): void => {
    if (value instanceof Texture) found.add(value.source);
    else if (value instanceof TextureSource) found.add(value);
    else if (isPlainRecord(value)) for (const child of Object.values(value)) visit(child);
  };
  visit(textures);
  return [...found];
}

/** The warm-up's steps after the bakes, in order; `commit` ends it. */
const WARM_UP_STEP = { uploads: 'uploads', draw: 'draw', render: 'render', commit: 'commit' } as const;
type WarmUpStep = (typeof WARM_UP_STEP)[keyof typeof WARM_UP_STEP];

export class WarmedRendererBuild {
  private step: WarmUpStep = WARM_UP_STEP.uploads;
  private uploads: TextureSource[] | null = null;

  /**
   * @param drawOnce the warm-up draw: renders the current frame on the staged renderer with the instrumentation
   * muted and nothing submitted; a session with no frame yet draws nothing and the render step still compiles.
   */
  constructor(
    private readonly build: RendererBuild,
    private readonly seam: RendererWarmUpSeam,
    private readonly drawOnce: (renderer: GameRenderer) => void,
  ) {}

  /** One step: a bake, a batch of uploads, the warm-up draw, the off-screen render; the committed renderer last. */
  advance(): GameRenderer | null {
    const staged = this.build.staged;
    if (staged === null) {
      this.build.advance();
      return null;
    }
    if (this.step === WARM_UP_STEP.uploads) {
      this.uploads ??= textureSourcesOf(staged.textures);
      for (const source of this.uploads.splice(0, RENDER_WARM_UP_UPLOADS_PER_FRAME))
        this.seam.uploadTextureSource(source);
      if (this.uploads.length === 0) this.step = WARM_UP_STEP.draw;
      return null;
    }
    if (this.step === WARM_UP_STEP.draw) {
      this.drawOnce(staged.renderer);
      this.step = WARM_UP_STEP.render;
      return null;
    }
    if (this.step === WARM_UP_STEP.render) {
      this.seam.renderOffscreen(staged.container);
      this.step = WARM_UP_STEP.commit;
      return null;
    }
    return this.build.commit();
  }

  /** Commits now, bakes left and warm-up skipped: a teardown mid-build, which must free what was made. */
  finish(): GameRenderer {
    return this.build.commit();
  }
}
