// The GPU time of a frame through `EXT_disjoint_timer_query_webgl2` (docs/RENDERING.md §7,
// `gpuMs`): one query brackets each submit, results are read back on later frames (a query
// resolves asynchronously), and the p95 of the resolved ones is the report's number. A context
// without the extension (SwiftShader, most mobile GPUs) yields `null` everywhere.

import { RENDER_SAMPLE_CAPACITY_FRAMES } from '../constants';
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

export interface GpuTimer {
  begin(): void;
  end(): void;
  /** Folds every resolved query into the window; the p95 of the window in ms, `null` before the first result. */
  p95Ms(): number | null;
  destroy(): void;
}

const EXTENSION_NAME = 'EXT_disjoint_timer_query_webgl2';
const NANOSECONDS_PER_MILLISECOND = 1_000_000;

/** `null` when the context lacks the extension. */
export function createGpuTimer(context: GpuTimerSource, capacity = RENDER_SAMPLE_CAPACITY_FRAMES): GpuTimer | null {
  const extension = context.getExtension(EXTENSION_NAME) as unknown as DisjointTimerQueryExtension | null;
  if (extension === null) return null;
  const samples = new SampleRing(capacity);
  const pending: WebGLQuery[] = [];
  let open: WebGLQuery | null = null;

  const collect = (): void => {
    while (pending.length > 0) {
      const query = pending[0]!;
      if (context.getQueryParameter(query, context.QUERY_RESULT_AVAILABLE) !== true) return;
      pending.shift();
      const isDisjoint = context.getParameter(extension.GPU_DISJOINT_EXT) === true;
      const nanoseconds = context.getQueryParameter(query, context.QUERY_RESULT);
      if (!isDisjoint && typeof nanoseconds === 'number') samples.push(nanoseconds / NANOSECONDS_PER_MILLISECOND);
      context.deleteQuery(query);
    }
  };

  return {
    begin: () => {
      open = context.createQuery();
      if (open !== null) context.beginQuery(extension.TIME_ELAPSED_EXT, open);
    },
    end: () => {
      if (open === null) return;
      context.endQuery(extension.TIME_ELAPSED_EXT);
      pending.push(open);
      open = null;
    },
    p95Ms: () => {
      collect();
      return samples.count === 0 ? null : samples.p95();
    },
    destroy: () => {
      for (const query of pending) context.deleteQuery(query);
      pending.length = 0;
    },
  };
}
