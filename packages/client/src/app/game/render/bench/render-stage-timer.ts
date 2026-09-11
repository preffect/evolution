// Brackets the seven CPU stages of a frame (docs/RENDERING.md §7) on the injected clock and keeps
// a ring of samples per stage and per frame, so p95s come from the last few hundred frames. The
// timer knows nothing about Pixi; the render loop calls begin / end around each stage.

import {
  MILLISECONDS_PER_SECOND,
  RENDER_STAGE_NAMES,
  type Clock,
  type ClientPerformanceReport,
  type RenderStageName,
} from '@evolution/shared';
import { P95_QUANTILE, RENDER_BENCH_SAMPLE_CAPACITY } from '../constants';

/** The rolling window's quantile at `quantile`; 0 with no samples. */
export function quantileOf(samples: readonly number[], quantile: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((first, second) => first - second);
  const index = Math.min(sorted.length - 1, Math.floor(quantile * sorted.length));
  return sorted[index] ?? 0;
}

class SampleRing {
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
  'fps' | 'frameTimeAvgMs' | 'frameTimeP95Ms' | 'frameTimePeakMs'
> & { renderStagesMs: Readonly<Record<RenderStageName, number>> };

export class RenderStageTimer {
  private readonly stages = new Map<RenderStageName, SampleRing>();
  private readonly frames: SampleRing;
  private readonly openStages = new Map<RenderStageName, number>();
  private frameStartMs: number | null = null;

  constructor(
    private readonly clock: Clock,
    capacity: number = RENDER_BENCH_SAMPLE_CAPACITY,
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

  begin(stage: RenderStageName): void {
    this.openStages.set(stage, this.clock.nowMilliseconds());
  }

  end(stage: RenderStageName): void {
    const started = this.openStages.get(stage);
    if (started === undefined) return;
    this.openStages.delete(stage);
    this.stages.get(stage)?.push(this.clock.nowMilliseconds() - started);
  }

  /** Runs `work` as one timed stage. */
  measure<Result>(stage: RenderStageName, work: () => Result): Result {
    this.begin(stage);
    try {
      return work();
    } finally {
      this.end(stage);
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
