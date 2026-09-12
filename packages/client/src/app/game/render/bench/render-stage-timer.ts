// Brackets the seven CPU stages of a frame (docs/RENDERING.md §7) on the injected clock and keeps
// a ring of samples per stage and per frame, so every p95 comes from the last few hundred frames.
// The timer knows nothing about Pixi: the session and the renderer call `measure` around each
// stage. Work done between frames (a snapshot applied on arrival) is `accrue`d to its stage and
// folded into that stage's next sample, so `net` reads apply + interpolation as §7 defines it.

import {
  MILLISECONDS_PER_SECOND,
  P95_QUANTILE,
  RENDER_STAGE_NAMES,
  type ClientPerformanceReport,
  type Clock,
  type RenderStageName,
} from '@evolution/shared';
import { RENDER_SAMPLE_CAPACITY_FRAMES } from '../constants';

/**
 * What a layer or the renderer needs: one bracket per stage (`measure`), plus `accrue` for a part of
 * a stage done elsewhere, folded into that stage's next sample. `UNTIMED_STAGES` runs the work bare.
 */
export interface StageMeasurer {
  measure<Result>(stage: RenderStageName, work: () => Result): Result;
  accrue<Result>(stage: RenderStageName, work: () => Result): Result;
}

export const UNTIMED_STAGES: StageMeasurer = { measure: (_stage, work) => work(), accrue: (_stage, work) => work() };

/** The sorted sample at `quantile` of the window; 0 with no samples. */
export function quantileOf(samples: readonly number[], quantile: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((first, second) => first - second);
  const index = Math.min(sorted.length - 1, Math.floor(quantile * sorted.length));
  return sorted[index] ?? 0;
}

export class SampleRing {
  private readonly samples: number[] = [];

  constructor(private readonly capacity: number) {}

  push(value: number): void {
    this.samples.push(value);
    if (this.samples.length > this.capacity) this.samples.shift();
  }

  p95(): number {
    return quantileOf(this.samples, P95_QUANTILE);
  }

  average(): number {
    if (this.samples.length === 0) return 0;
    return this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length;
  }

  peak(): number {
    return this.samples.reduce((peak, value) => Math.max(peak, value), 0);
  }

  get count(): number {
    return this.samples.length;
  }
}

export type FrameTimingReport = Pick<
  ClientPerformanceReport,
  'fps' | 'frameTimeAvgMs' | 'frameTimeP95Ms' | 'frameTimePeakMs' | 'renderStagesMs'
>;

export class RenderStageTimer implements StageMeasurer {
  private readonly stages = new Map<RenderStageName, SampleRing>();
  private readonly accrued = new Map<RenderStageName, number>();
  /** The brackets in progress, outermost first. */
  private readonly open: { started: number; nestedMs: number }[] = [];
  private readonly frames: SampleRing;
  private frameStartMs: number | null = null;

  constructor(
    private readonly clock: Clock,
    capacity: number = RENDER_SAMPLE_CAPACITY_FRAMES,
  ) {
    this.frames = new SampleRing(capacity);
    for (const stage of RENDER_STAGE_NAMES) this.stages.set(stage, new SampleRing(capacity));
  }

  beginFrame(): void {
    this.frameStartMs = this.clock.nowMilliseconds();
  }

  /** Closes the frame; a frame never begun records nothing. */
  endFrame(): void {
    if (this.frameStartMs === null) return;
    this.frames.push(this.clock.nowMilliseconds() - this.frameStartMs);
    this.frameStartMs = null;
  }

  /**
   * Runs `work` as one sample of `stage`, plus whatever was accrued to the stage since its last sample.
   * A stage measured inside another (organelles inside cells) is taken out of the outer sample, so the
   * seven keys add up to the frame's CPU time without double counting.
   */
  measure<Result>(stage: RenderStageName, work: () => Result): Result {
    const bracket = { started: this.clock.nowMilliseconds(), nestedMs: 0 };
    this.open.push(bracket);
    try {
      return work();
    } finally {
      this.open.pop();
      const elapsed = this.clock.nowMilliseconds() - bracket.started;
      const parent = this.open[this.open.length - 1];
      if (parent !== undefined) parent.nestedMs += elapsed;
      const carried = this.accrued.get(stage) ?? 0;
      this.accrued.delete(stage);
      this.stages.get(stage)?.push(elapsed - bracket.nestedMs + carried);
    }
  }

  /** Runs `work` outside a frame (a message handler) and charges its time to the stage's next sample. */
  accrue<Result>(stage: RenderStageName, work: () => Result): Result {
    const started = this.clock.nowMilliseconds();
    try {
      return work();
    } finally {
      const elapsed = this.clock.nowMilliseconds() - started;
      this.accrued.set(stage, (this.accrued.get(stage) ?? 0) + elapsed);
    }
  }

  get frameCount(): number {
    return this.frames.count;
  }

  report(): FrameTimingReport {
    const renderStagesMs = {} as Record<RenderStageName, number>;
    for (const stage of RENDER_STAGE_NAMES) renderStagesMs[stage] = this.stages.get(stage)?.p95() ?? 0;
    const average = this.frames.average();
    return {
      fps: average > 0 ? MILLISECONDS_PER_SECOND / average : 0,
      frameTimeAvgMs: average,
      frameTimeP95Ms: this.frames.p95(),
      frameTimePeakMs: this.frames.peak(),
      renderStagesMs,
    };
  }
}
