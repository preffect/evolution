// Brackets the seven CPU stages of a frame (docs/RENDERING.md §7) on the injected clock and keeps
// a ring of samples per stage, per frame and for the frame's unbracketed residual, so every p95
// comes from the last few hundred frames. The timer knows nothing about Pixi: the session and the
// renderer call `measure` around each stage. Work done between frames (a snapshot applied on
// arrival) is `accrue`d to its stage and folded into that stage's next sample, so `net` reads
// apply + interpolation as §7 defines it.

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

/**
 * The sample at `quantile` of the window by linear interpolation between the two neighbouring ranks
 * (the estimator Excel's `PERCENTILE.INC` and R's type 7 use); 0 with no samples. A window shorter than
 * `1 / (1 − quantile)` samples cannot support the quantile at all — it degenerates to the maximum — which
 * is why the verdict refuses to judge a p95 below `RENDER_P95_MIN_SAMPLE_FRAMES` (docs/RENDERING.md §7).
 */
export function quantileOf(samples: readonly number[], quantile: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((first, second) => first - second);
  const position = quantile * (sorted.length - 1);
  const lowerRank = Math.floor(position);
  const lower = sorted[lowerRank] ?? 0;
  const upper = sorted[Math.min(sorted.length - 1, lowerRank + 1)] ?? lower;
  return lower + (upper - lower) * (position - lowerRank);
}

/**
 * A fixed-size circular window of samples: a push past the capacity overwrites the oldest in place, so a
 * frame costs the instrument one store and no array moves. The window is materialised only when a report
 * reads it.
 */
export class SampleRing {
  private readonly samples: number[] = [];
  private oldest = 0;
  private size = 0;

  constructor(private readonly capacity: number) {}

  push(value: number): void {
    this.samples[(this.oldest + this.size) % this.capacity] = value;
    if (this.size < this.capacity) this.size += 1;
    else this.oldest = (this.oldest + 1) % this.capacity;
  }

  /** Drops the newest sample (a frame abandoned after its stage was measured). */
  pop(): void {
    if (this.size > 0) this.size -= 1;
  }

  /** The window oldest first. */
  window(): number[] {
    const values: number[] = [];
    for (let offset = 0; offset < this.size; offset += 1) {
      values.push(this.samples[(this.oldest + offset) % this.capacity] ?? 0);
    }
    return values;
  }

  p95(): number {
    return quantileOf(this.window(), P95_QUANTILE);
  }

  average(): number {
    if (this.size === 0) return 0;
    return this.window().reduce((sum, value) => sum + value, 0) / this.size;
  }

  peak(): number {
    return this.window().reduce((peak, value) => Math.max(peak, value), 0);
  }

  /** The smallest sample; 0 with no samples. */
  minimum(): number {
    if (this.size === 0) return 0;
    return this.window().reduce((smallest, value) => Math.min(smallest, value), Number.POSITIVE_INFINITY);
  }

  get count(): number {
    return this.size;
  }
}

export type FrameTimingReport = Pick<
  ClientPerformanceReport,
  'fps' | 'frameTimeAvgMs' | 'frameTimeP95Ms' | 'frameTimePeakMs' | 'renderStagesMs'
>;

/**
 * Per frame, `frame − Σ its top-level brackets`: the share of the frame no stage key covers (the HUD, the
 * dish placement, the browser). Measured frame by frame, so it is never the difference of two p95s.
 */
export interface FrameResidual {
  readonly p95Ms: number;
  readonly peakMs: number;
  readonly minimumMs: number;
}

export class RenderStageTimer implements StageMeasurer {
  private readonly stages = new Map<RenderStageName, SampleRing>();
  private readonly accrued = new Map<RenderStageName, number>();
  /** The brackets in progress, outermost first. */
  private readonly open: { started: number; nestedMs: number }[] = [];
  private readonly frames: SampleRing;
  private readonly residuals: SampleRing;
  private frameStartMs: number | null = null;
  /** The open frame's top-level bracket time, so the residual is measured and not derived. */
  private frameBracketedMs = 0;

  constructor(
    private readonly clock: Clock,
    capacity: number = RENDER_SAMPLE_CAPACITY_FRAMES,
  ) {
    this.frames = new SampleRing(capacity);
    this.residuals = new SampleRing(capacity);
    for (const stage of RENDER_STAGE_NAMES) this.stages.set(stage, new SampleRing(capacity));
  }

  beginFrame(): void {
    this.frameStartMs = this.clock.nowMilliseconds();
    this.frameBracketedMs = 0;
  }

  /** Closes the frame and records its residual; a frame never begun records nothing. */
  endFrame(): void {
    if (this.frameStartMs === null) return;
    const elapsed = this.clock.nowMilliseconds() - this.frameStartMs;
    this.frames.push(elapsed);
    this.residuals.push(elapsed - this.frameBracketedMs);
    this.frameStartMs = null;
  }

  /**
   * Abandons the open frame because it produced nothing to draw: no frame or residual sample, and the
   * sample `stage` pushed inside it is dropped (with whatever it carried) rather than biasing the stage
   * down with a frame that did no work.
   */
  cancelFrame(stage: RenderStageName): void {
    this.stages.get(stage)?.pop();
    this.frameStartMs = null;
    this.frameBracketedMs = 0;
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
      this.chargeToParent(elapsed);
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
      this.chargeToParent(elapsed);
      this.accrued.set(stage, (this.accrued.get(stage) ?? 0) + elapsed);
    }
  }

  /**
   * A bracket's time belongs to whatever encloses it: to the open bracket as nested time (taken out of that
   * stage's sample), or, at the top level of a frame, to the frame's bracketed share.
   */
  private chargeToParent(elapsedMs: number): void {
    const parent = this.open[this.open.length - 1];
    if (parent !== undefined) parent.nestedMs += elapsedMs;
    else if (this.frameStartMs !== null) this.frameBracketedMs += elapsedMs;
  }

  get frameCount(): number {
    return this.frames.count;
  }

  /** The frame's unbracketed share, measured per frame (§7's HUD row). */
  residual(): FrameResidual {
    return { p95Ms: this.residuals.p95(), peakMs: this.residuals.peak(), minimumMs: this.residuals.minimum() };
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
