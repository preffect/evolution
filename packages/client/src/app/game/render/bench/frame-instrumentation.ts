// What both sessions (a live room, the bench route) wrap around a frame to fill a
// `ClientPerformanceReport` (docs/RENDERING.md §7): the stage timer the renderer brackets its
// stages with, the draw-call counter and the GPU timer query on the app's GL context, and the
// report built from the three plus the renderer's counts. The session decides when to report.

import { RENDER_STAGE, type ClientPerformanceReport, type Clock } from '@evolution/shared';
import type { Application } from 'pixi.js';
import type { RenderFrame } from '../../net/world-store';
import type { RenderOutputs } from '../game-renderer';
import { createDrawCallCounter, type DrawCallCounter, type DrawCallSource } from './draw-call-counter';
import { createGpuTimer, type GpuTimer, type GpuTimerSource } from './gpu-timer';
import { buildPerformanceReport } from './render-benchmark';
import { RenderStageTimer } from './render-stage-timer';

export interface FrameCounts {
  readonly visibleCells: number;
  readonly visibleMotes: number;
}

/** The renderer's GL context when it is a WebGL one (`preference: 'webgl'` in pixi-app.ts); `null` under a fake or WebGPU. */
function glContextOf(app: Application): (DrawCallSource & GpuTimerSource) | null {
  const renderer: unknown = app.renderer;
  if (typeof renderer !== 'object' || renderer === null || !('gl' in renderer)) return null;
  const context = (renderer as { gl: unknown }).gl;
  return typeof context === 'object' && context !== null ? (context as DrawCallSource & GpuTimerSource) : null;
}

export class FrameInstrumentation {
  readonly timer: RenderStageTimer;
  private drawCalls: DrawCallCounter | null = null;
  private gpu: GpuTimer | null = null;
  private frames = 0;

  constructor(clock: Clock, capacity?: number) {
    this.timer = new RenderStageTimer(clock, capacity);
  }

  /** Wraps the app's GL draw calls and opens the GPU timer; a context without one leaves `gpuMs` null. */
  attach(app: Application): void {
    const context = glContextOf(app);
    if (context === null) return;
    this.drawCalls = createDrawCallCounter(context);
    this.gpu = createGpuTimer(context);
  }

  /** Frames submitted since `attach`. */
  get frameCount(): number {
    return this.frames;
  }

  /**
   * One instrumented frame: the frame bracket, `net` around the store's frame, the renderer's own stages,
   * the submit counted and queried. `null` when the store has no frame yet.
   */
  runFrame(
    nextFrame: () => RenderFrame | null,
    render: (frame: RenderFrame, submit: () => void) => RenderOutputs,
    submit: () => void,
  ): { frame: RenderFrame; outputs: RenderOutputs } | null {
    this.timer.beginFrame();
    const frame = this.timer.measure(RENDER_STAGE.net, nextFrame);
    if (frame === null) return null;
    const outputs = render(frame, () => this.submit(submit));
    this.timer.endFrame();
    return { frame, outputs };
  }

  /** The submit stage's body: counts the frame's draw calls and brackets it in a GPU query. */
  submit(render: () => void): void {
    this.drawCalls?.reset();
    this.gpu?.begin();
    render();
    this.gpu?.end();
    this.frames += 1;
  }

  report(counts: FrameCounts, heapBytes: number | null): ClientPerformanceReport {
    return buildPerformanceReport(this.timer.report(), {
      drawCalls: this.drawCalls?.count() ?? 0,
      gpuMs: this.gpu?.p95Ms() ?? null,
      heapBytes,
      ...counts,
    });
  }

  destroy(): void {
    this.gpu?.destroy();
    this.gpu = null;
    this.drawCalls = null;
  }
}
