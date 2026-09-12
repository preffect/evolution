// The GPU time of a frame through `EXT_disjoint_timer_query_webgl2` (docs/RENDERING.md §7,
// `gpuMs`): one query brackets each submit, results are read back on later frames (a query resolves
// asynchronously), and the p95 of the resolved ones is the report's number.
//
// A reported number must be physically possible, so every sample is checked against the wall clock
// between the two submits it brackets: in steady state a frame's GPU time cannot exceed its frame
// period, or the GPU falls unboundedly behind. A sample past `RENDER_GPU_SAMPLE_MAX_FRAME_RATIO ×`
// that period is not a measurement, so the timer drops it and reports `implausible` — and a context
// that produced one is not trusted for the rest of the session. `gpuMs` is then `null`, the report's
// one "unavailable" value, which it also is without the extension (SwiftShader, most mobile GPUs),
// before the first query resolves, and after a disjoint event.

import { NANOSECONDS_PER_MILLISECOND, type Clock } from '@evolution/shared';
import { RENDER_GPU_SAMPLE_MAX_FRAME_RATIO, RENDER_SAMPLE_CAPACITY_FRAMES } from '../constants';
import { SampleRing } from './render-stage-timer';

/** The extension's members the timer uses (the DOM lib does not declare the WebGL2 variant). */
export type DisjointTimerQueryExtension = Readonly<Record<'TIME_ELAPSED_EXT' | 'GPU_DISJOINT_EXT', number>>;

/** The slice of a WebGL2 context the timer uses. */
export type GpuTimerSource = Pick<
  WebGL2RenderingContext,
  | 'getExtension'
  | 'getParameter'
  | 'createQuery'
  | 'beginQuery'
  | 'endQuery'
  | 'getQueryParameter'
  | 'deleteQuery'
  | 'QUERY_RESULT_AVAILABLE'
  | 'QUERY_RESULT'
>;

/** Why `gpuMs` is what it is (docs/RENDERING.md §7). Only `ok` carries a number. */
export const GPU_TIMER_STATUS = {
  /** The window holds at least one plausible sample. */
  ok: 'ok',
  /** The context has no `EXT_disjoint_timer_query_webgl2`. */
  unsupported: 'unsupported',
  /** The extension is there but no query has resolved into the window yet. */
  pending: 'pending',
  /** The extension reported a time a frame cannot have taken: the context is not trusted again. */
  implausible: 'implausible',
} as const;
export type GpuTimerStatus = (typeof GPU_TIMER_STATUS)[keyof typeof GPU_TIMER_STATUS];

export interface GpuTimer {
  begin(): void;
  end(): void;
  /** Folds every resolved query into the window; the p95 of the window in ms, `null` when the status is not `ok`. */
  p95Ms(): number | null;
  /** Why the last `p95Ms` was or was not a number. */
  status(): GpuTimerStatus;
  /** Samples the extension reported that no frame could have taken. */
  readonly implausibleCount: number;
  destroy(): void;
}

export interface GpuTimerOptions {
  /** The wall clock the frame period is measured on: the same `Clock` the stage timer reads. */
  readonly clock: Clock;
  /** Frames the window covers; the stage timer's capacity, so `gpuMs` covers the frames the report does. */
  readonly capacity?: number;
}

const EXTENSION_NAME = 'EXT_disjoint_timer_query_webgl2';

interface PendingQuery {
  readonly query: WebGLQuery;
  /** Wall ms between this submit and the one before; `null` for the first, which has no period to check. */
  readonly framePeriodMs: number | null;
}

class DisjointTimerQueryTimer implements GpuTimer {
  private readonly samples: SampleRing;
  private readonly pending: PendingQuery[] = [];
  /** Resolved query objects, reused instead of created and deleted every frame. */
  private readonly free: WebGLQuery[] = [];
  private open: WebGLQuery | null = null;
  private lastEndMs: number | null = null;
  private implausible = 0;

  constructor(
    private readonly context: GpuTimerSource,
    private readonly extension: DisjointTimerQueryExtension,
    private readonly clock: Clock,
    capacity: number,
  ) {
    this.samples = new SampleRing(capacity);
  }

  begin(): void {
    this.dropOnDisjoint();
    this.open = this.free.pop() ?? this.context.createQuery();
    if (this.open !== null) this.context.beginQuery(this.extension.TIME_ELAPSED_EXT, this.open);
  }

  end(): void {
    if (this.open === null) return;
    this.context.endQuery(this.extension.TIME_ELAPSED_EXT);
    const endedMs = this.clock.nowMilliseconds();
    this.pending.push({ query: this.open, framePeriodMs: this.lastEndMs === null ? null : endedMs - this.lastEndMs });
    this.lastEndMs = endedMs;
    this.open = null;
  }

  p95Ms(): number | null {
    this.collect();
    return this.status() === GPU_TIMER_STATUS.ok ? this.samples.p95() : null;
  }

  status(): GpuTimerStatus {
    if (this.implausible > 0) return GPU_TIMER_STATUS.implausible;
    return this.samples.count === 0 ? GPU_TIMER_STATUS.pending : GPU_TIMER_STATUS.ok;
  }

  get implausibleCount(): number {
    return this.implausible;
  }

  destroy(): void {
    for (const entry of this.pending) this.context.deleteQuery(entry.query);
    for (const query of this.free) this.context.deleteQuery(query);
    this.pending.length = 0;
    this.free.length = 0;
  }

  /** A disjoint event invalidates every query in flight, and reading the flag clears it, so it is read per frame. */
  private dropOnDisjoint(): void {
    if (this.context.getParameter(this.extension.GPU_DISJOINT_EXT) !== true) return;
    for (const entry of this.pending) this.free.push(entry.query);
    this.pending.length = 0;
  }

  /** Reads back every query that has resolved, oldest first: a later one is never read before an earlier one. */
  private collect(): void {
    while (this.pending.length > 0) {
      const entry = this.pending[0]!;
      if (this.context.getQueryParameter(entry.query, this.context.QUERY_RESULT_AVAILABLE) !== true) return;
      this.pending.shift();
      const nanoseconds = this.context.getQueryParameter(entry.query, this.context.QUERY_RESULT);
      if (typeof nanoseconds === 'number') this.keep(entry, nanoseconds / NANOSECONDS_PER_MILLISECOND);
      this.free.push(entry.query);
    }
  }

  /** Keeps a sample only if a frame of that period could have spent that long on the GPU. */
  private keep(entry: PendingQuery, milliseconds: number): void {
    if (entry.framePeriodMs === null) return;
    if (milliseconds > entry.framePeriodMs * RENDER_GPU_SAMPLE_MAX_FRAME_RATIO) {
      this.implausible += 1;
      return;
    }
    this.samples.push(milliseconds);
  }
}

/** `null` when the context lacks the extension. */
export function createGpuTimer(context: GpuTimerSource, options: GpuTimerOptions): GpuTimer | null {
  const extension = context.getExtension(EXTENSION_NAME) as unknown as DisjointTimerQueryExtension | null;
  if (extension === null) return null;
  return new DisjointTimerQueryTimer(
    context,
    extension,
    options.clock,
    options.capacity ?? RENDER_SAMPLE_CAPACITY_FRAMES,
  );
}
