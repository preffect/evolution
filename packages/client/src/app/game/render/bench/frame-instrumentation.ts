// What both sessions (a live room, the bench route) wrap around a frame to fill a
// `ClientPerformanceReport` (docs/RENDERING.md §7): the stage timer the renderer brackets its
// stages with, the draw-call counter and the GPU timer query on the app's GL context, and the
// report built from the three plus the renderer's counts. The session decides when to report.

import { RENDER_STAGE, type ClientPerformanceReport, type Clock } from '@evolution/shared';
import type { Application } from 'pixi.js';
import type { RenderFrame } from '../../net/world-store';
import { RENDER_SAMPLE_CAPACITY_FRAMES } from '../constants';
import type { RenderOutputs } from '../game-renderer';
import { createDrawCallCounter, type DrawCallCounter, type DrawCallSource } from './draw-call-counter';
import { createGpuTimer, GPU_TIMER_STATUS, type GpuTimer, type GpuTimerSource, type GpuTimerStatus } from './gpu-timer';
import { buildPerformanceReport, type FrameEvidence } from './render-benchmark';
import { RenderStageTimer, SampleRing } from './render-stage-timer';

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
  private readonly capacity: number;
  private readonly drawCallsPerFrame: SampleRing;
  private drawCalls: DrawCallCounter | null = null;
  private gpu: GpuTimer | null = null;
  private frames = 0;

  constructor(
    private readonly clock: Clock,
    capacity: number = RENDER_SAMPLE_CAPACITY_FRAMES,
  ) {
    this.capacity = capacity;
    this.timer = new RenderStageTimer(clock, capacity);
    this.drawCallsPerFrame = new SampleRing(capacity);
  }

  /**
   * Wraps the app's GL draw calls and opens the GPU timer over the same window the stage timer covers; a
   * context without one leaves `gpuMs` null. Attaching twice would wrap the wrappers, so the first attach wins.
   */
  attach(app: Application): void {
    if (this.drawCalls !== null) return;
    const context = glContextOf(app);
    if (context === null) return;
    this.drawCalls = createDrawCallCounter(context);
    this.gpu = createGpuTimer(context, { clock: this.clock, capacity: this.capacity });
  }

  /** Frames submitted since `attach`. */
  get frameCount(): number {
    return this.frames;
  }

  /**
   * One instrumented frame: the frame bracket, `net` around the store's frame, the renderer's own stages,
   * the submit counted and queried. `null` when the store has no frame yet — a frame that drew nothing
   * records no sample at all, rather than biasing `net` and the frame time down with an empty pass.
   */
  runFrame(
    nextFrame: () => RenderFrame | null,
    render: (frame: RenderFrame, submit: () => void) => RenderOutputs,
    submit: () => void,
  ): { frame: RenderFrame; outputs: RenderOutputs } | null {
    this.timer.beginFrame();
    const frame = this.timer.measure(RENDER_STAGE.net, nextFrame);
    if (frame === null) {
      this.timer.cancelFrame(RENDER_STAGE.net);
      return null;
    }
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
    if (this.drawCalls !== null) this.drawCallsPerFrame.push(this.drawCalls.count());
    this.frames += 1;
  }

  /** Why `gpuMs` is a number or `null`. */
  get gpuStatus(): GpuTimerStatus {
    return this.gpu?.status() ?? GPU_TIMER_STATUS.unsupported;
  }

  /** What the window says beyond the wire report (the verdict's evidence). */
  evidence(): FrameEvidence {
    return { sampleCount: this.timer.frameCount, residual: this.timer.residual(), gpuStatus: this.gpuStatus };
  }

  report(counts: FrameCounts, heapBytes: number | null): ClientPerformanceReport {
    return buildPerformanceReport(this.timer.report(), {
      drawCalls: this.drawCallsPerFrame.peak(),
      gpuMs: this.gpu?.p95Ms() ?? null,
      heapBytes,
      ...counts,
    });
  }

  destroy(): void {
    this.gpu?.destroy();
    this.gpu = null;
    this.drawCalls?.restore();
    this.drawCalls = null;
  }
}
