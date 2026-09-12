// The frame loop both sessions run (docs/RENDERING.md §7): a live room (`render-session.ts`) and
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

export abstract class FrameLoopSession {
  readonly gate = new FrameGate();
  readonly instrumentation: FrameInstrumentation;
  protected pixi: PixiAppHandle | null = null;
  private readonly slot = new RendererSlot();
  /** The tick of the frame on screen: what the debug hook reports, held while paused. */
  private lastRenderedTickValue: number | null = null;

  protected constructor(clock: Clock, sampleCapacityFrames?: number) {
    this.instrumentation = new FrameInstrumentation(clock, sampleCapacityFrames);
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
    pixi.app.ticker.add(() => this.frame());
  }

  /** Builds the renderer over textures baked from `options` on the adopted app; `null` before one is adopted. */
  protected buildRenderer(options: Omit<RenderTextureOptions, 'baker'>): GameRenderer | null {
    if (this.pixi === null) return null;
    this.lastRenderedTickValue = null;
    const { app, textures } = this.pixi;
    return this.slot.build(app.stage, app.screen, { ...options, baker: textures }, this.instrumentation.timer);
  }

  /** The frame to draw now, or `null` when there is none yet. */
  protected abstract nextFrame(): RenderFrame | null;
  protected abstract renderFrame(renderer: GameRenderer, frame: RenderFrame, submit: () => void): RenderOutputs;
  protected abstract afterFrame(outputs: RenderOutputs): void;

  /** One ticker callback: one instrumented frame unless the gate holds it or nothing is ready. */
  frame(): void {
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
    this.slot.dispose();
    this.lastRenderedTickValue = null;
    this.instrumentation.destroy();
    this.pixi?.destroy();
    this.pixi = null;
  }
}
