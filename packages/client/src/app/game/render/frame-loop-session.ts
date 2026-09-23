// The frame loop both sessions run (docs/rendering/budget.md §7): a live room (`render-session.ts`) and
// the bench route (`bench/bench-session.ts`) each adopt one Pixi app's ticker, hold one renderer in
// a `RendererSlot`, gate frames for the debug hook and run every frame through the
// `FrameInstrumentation`. What differs (where a frame comes from, what happens after it) is the
// subclass's; the loop, the gate and the report plumbing are written once here.

import type { Clock } from '@evolution/shared';
import { FrameGate, loopDebugMembers, type EvolutionDebugApi } from '../debug/evolution-debug';
import type { RenderFrame } from '../net/world-store';
import { FrameInstrumentation } from './bench/frame-instrumentation';
import type { GameRenderer, RenderOutputs } from './game-renderer';
import type { PixiAppHandle } from './pixi-app';
import type { RenderTextureOptions } from './render-textures';
import { RendererSlot } from './renderer-slot';
import { MutableStageMeasurer, WarmedRendererBuild } from './renderer-warm-up';

/** The warm-up draw submits nothing: the staged renderer is off the stage and its frame is never shown. */
const NO_SUBMIT = (): void => undefined;

/** A staged build in flight, and whoever waits for it. */
interface PendingBuild {
  readonly build: WarmedRendererBuild;
  readonly resolve: (renderer: GameRenderer | null) => void;
  /** A bake that threw: the build fails as a promise, never out of the ticker (Pixi v8 stops a ticker that throws). */
  readonly reject: (error: unknown) => void;
}

export abstract class FrameLoopSession {
  readonly gate = new FrameGate();
  readonly instrumentation: FrameInstrumentation;
  protected pixi: PixiAppHandle | null = null;
  private readonly slot = new RendererSlot();
  /** The stage brackets a staged renderer is built with: muted for its warm-up draw (ticket #603). */
  private readonly stagedStages: MutableStageMeasurer;
  /** The tick of the frame on screen: what the debug hook reports, held while paused. */
  private lastRenderedTickValue: number | null = null;
  /** The staged build the ticker is advancing, one bake per frame; `null` when none is in flight. */
  private pendingBuild: PendingBuild | null = null;
  /** Runs every animation frame whether or not a frame is drawn; `null` until one is set. */
  private animationFrameListener: (() => void) | null = null;
  /** The callback `adoptPixiApp` put on the app's ticker, taken off again on dispose: a kept app outlives us. */
  private readonly tickerListener = (): void => {
    this.animationFrameListener?.();
    this.frame();
  };

  protected constructor(clock: Clock, sampleCapacityFrames?: number) {
    this.instrumentation = new FrameInstrumentation(clock, sampleCapacityFrames);
    this.stagedStages = new MutableStageMeasurer(this.instrumentation.timer);
  }

  get lastRenderedTick(): number | null {
    return this.lastRenderedTickValue;
  }

  protected get renderer(): GameRenderer | null {
    return this.slot.current;
  }

  /** Takes the app's ticker over: from here the app renders only through `frame`. */
  protected adoptPixiApp(pixi: PixiAppHandle): void {
    this.pixi = pixi;
    this.instrumentation.attach(pixi.app);
    pixi.app.ticker.remove(pixi.app.render, pixi.app);
    pixi.app.ticker.add(this.tickerListener);
  }

  /**
   * Called once per animation frame, before the gate: the input controller's pump runs here so it
   * keeps its own `TICK_HZ` cadence off the injected clock (docs/architecture/client.md §5) instead of a
   * timer of its own, which game code may not own (docs/CODE-STANDARDS.md §8).
   */
  setAnimationFrameListener(listener: (() => void) | null): void {
    this.animationFrameListener = listener;
  }

  /** Builds the renderer over textures baked from `options` on the adopted app; `null` before one is adopted. */
  protected buildRenderer(options: Omit<RenderTextureOptions, 'baker'>): GameRenderer | null {
    if (this.pixi === null) return null;
    this.lastRenderedTickValue = null;
    const { app, textures } = this.pixi;
    return this.slot.build(app.stage, app.screen, { ...options, baker: textures }, this.instrumentation.timer);
  }

  /**
   * The same build staged across frames (ticket #479): the ticker runs one bake per animation frame, so the page
   * keeps painting and taking input while a room's textures are baked, and the current renderer (a rematch's)
   * keeps drawing until the new one swaps in on the last bake. Resolves with the new renderer, or `null` when no
   * app is adopted or the session is torn down first; rejects when a bake throws, and the ticker runs on. One at a
   * time: the caller queues the next behind this one.
   */
  protected buildRendererAcrossFrames(options: Omit<RenderTextureOptions, 'baker'>): Promise<GameRenderer | null> {
    if (this.pixi === null) return Promise.resolve(null);
    const { app, textures } = this.pixi;
    const staged = this.slot.beginBuild(app.stage, app.screen, { ...options, baker: textures }, this.stagedStages);
    const build = new WarmedRendererBuild(staged, this.pixi.warmUp, (renderer) => this.warmUpDraw(renderer));
    return new Promise((resolve, reject) => {
      this.pendingBuild = { build, resolve, reject };
    });
  }

  /**
   * The warm-up draw of a staged renderer, off the stage: the current frame through the subclass's own
   * `renderFrame`, with the stage brackets muted and nothing submitted, so its first-time CPU work is spent before
   * the reveal and reported nowhere. No frame yet (the store has nothing) draws nothing.
   */
  private warmUpDraw(renderer: GameRenderer): void {
    const frame = this.pixi === null ? null : this.nextFrame();
    if (this.pixi === null || frame === null) return;
    renderer.resize(this.pixi.app.screen);
    this.stagedStages.isMuted = true;
    try {
      this.renderFrame(renderer, frame, NO_SUBMIT);
    } finally {
      this.stagedStages.isMuted = false;
    }
  }

  /** Whether a staged build is still baking: its renderer is not current yet. */
  get isBuildingRenderer(): boolean {
    return this.pendingBuild !== null;
  }

  /**
   * One step of the build in flight (a bake, uploads, the warm-up draw, the off-screen render); on the last, the new
   * renderer is current and the waiter hears it. `true` on that frame, which draws nothing: it carried the commit.
   */
  private advancePendingBuild(): boolean {
    const pending = this.pendingBuild;
    if (pending === null) return false;
    let renderer: GameRenderer | null;
    try {
      renderer = pending.build.advance();
    } catch (error: unknown) {
      // Caught here, not in the ticker: a listener that throws stops Pixi's ticker for good (input and frames with
      // it). The build fails as its promise instead — the session records a start-up error, the next build proceeds.
      this.pendingBuild = null;
      pending.reject(error);
      return false;
    }
    if (renderer === null) return false;
    this.pendingBuild = null;
    this.lastRenderedTickValue = null;
    pending.resolve(renderer);
    return true;
  }

  /** The frame to draw now, or `null` when there is none yet. */
  protected abstract nextFrame(): RenderFrame | null;
  protected abstract renderFrame(renderer: GameRenderer, frame: RenderFrame, submit: () => void): RenderOutputs;
  protected abstract afterFrame(outputs: RenderOutputs): void;

  /** One ticker callback: one instrumented frame unless the gate holds it or nothing is ready. */
  frame(): void {
    if (this.advancePendingBuild()) return;
    const renderer = this.slot.current;
    if (this.pixi === null || renderer === null || !this.gate.claimFrame()) return;
    const { app } = this.pixi;
    renderer.resize(app.screen);
    const rendered = this.instrumentation.runFrame(
      () => this.nextFrame(),
      (frame, submit) => this.renderFrame(renderer, frame, submit),
      () => app.render(),
    );
    if (rendered === null) return;
    this.lastRenderedTickValue = rendered.frame.renderTick;
    this.afterFrame(rendered.outputs);
  }

  /** The hook members the gate and the loop answer; the subclass adds its mode, `step`, `setSeed` and the report. */
  protected loopDebugMembers(): Pick<
    EvolutionDebugApi,
    'pause' | 'resume' | 'isPaused' | 'renderTick' | 'framesRendered'
  > {
    return loopDebugMembers(this.gate, {
      renderTick: () => this.lastRenderedTickValue,
      framesRendered: () => this.instrumentation.frameCount,
    });
  }

  /** Drops the renderer, the instrumentation and the app. */
  protected disposeLoop(): void {
    try {
      this.finishPendingBuild();
    } finally {
      this.releaseLoop();
    }
  }

  /**
   * A build torn down mid-bake has half its textures made and its fonts installed: it is finished and swapped in,
   * so the slot's dispose frees every one of them rather than leaking what was already baked. Its waiter always
   * hears `null`, even when the finishing bake throws, so no queued build waits on it forever.
   */
  private finishPendingBuild(): void {
    const pending = this.pendingBuild;
    this.pendingBuild = null;
    try {
      pending?.build.finish();
    } finally {
      pending?.resolve(null);
    }
  }

  private releaseLoop(): void {
    this.pixi?.unbindTextures();
    this.slot.dispose();
    this.lastRenderedTickValue = null;
    this.instrumentation.destroy();
    this.pixi?.app.ticker.remove(this.tickerListener);
    this.pixi?.destroy();
    this.pixi = null;
  }
}
