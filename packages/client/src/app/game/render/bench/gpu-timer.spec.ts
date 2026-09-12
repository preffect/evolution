import { ManualClock } from '@evolution/shared';
import { describe, expect, it, vi } from 'vitest';
import { RENDER_GPU_SAMPLE_MAX_FRAME_RATIO } from '../constants';
import { GPU_TIMER_STATUS, createGpuTimer, type GpuTimer, type GpuTimerSource } from './gpu-timer';

const TIME_ELAPSED_EXT = 0x88bf;
const GPU_DISJOINT_EXT = 0x8fbb;
const QUERY_RESULT_AVAILABLE = 0x8867;
const QUERY_RESULT = 0x8866;
/** The GL enums as the context and the extension expose them (built by name: the WebGL API's, not ours). */
const CONTEXT_ENUMS = Object.fromEntries([
  ['QUERY_RESULT_AVAILABLE', QUERY_RESULT_AVAILABLE],
  ['QUERY_RESULT', QUERY_RESULT],
]);
const EXTENSION_ENUMS = Object.fromEntries([
  ['TIME_ELAPSED_EXT', TIME_ELAPSED_EXT],
  ['GPU_DISJOINT_EXT', GPU_DISJOINT_EXT],
]);
const NANOSECONDS_PER_MILLISECOND = 1_000_000;
/** The wall time between two submits in these tests: every plausible sample is measured against it. */
const FRAME_PERIOD_MS = 100;

interface FakeQuery {
  isAvailable: boolean;
  nanoseconds: number;
}

/** A context whose queries resolve when the test says so. */
function fakeContext(hasExtension = true) {
  const queries: FakeQuery[] = [];
  let isDisjoint = false;
  const context = {
    ...CONTEXT_ENUMS,
    getExtension: (name: string) =>
      hasExtension && name === 'EXT_disjoint_timer_query_webgl2' ? EXTENSION_ENUMS : null,
    getParameter: (name: number) => (name === GPU_DISJOINT_EXT ? isDisjoint : null),
    createQuery: vi.fn(() => {
      const query: FakeQuery = { isAvailable: false, nanoseconds: 0 };
      queries.push(query);
      return query as unknown as WebGLQuery;
    }),
    beginQuery: vi.fn(),
    endQuery: vi.fn(),
    getQueryParameter: (query: WebGLQuery, name: number) => {
      const fake = query as unknown as FakeQuery;
      return name === QUERY_RESULT_AVAILABLE ? fake.isAvailable : fake.nanoseconds;
    },
    deleteQuery: vi.fn(),
  } as unknown as GpuTimerSource & {
    createQuery: ReturnType<typeof vi.fn>;
    deleteQuery: ReturnType<typeof vi.fn>;
    beginQuery: ReturnType<typeof vi.fn>;
  };
  return {
    context,
    queries,
    resolve: (index: number, milliseconds: number) => {
      queries[index]!.isAvailable = true;
      queries[index]!.nanoseconds = milliseconds * NANOSECONDS_PER_MILLISECOND;
    },
    setDisjoint: (isDisjointNow: boolean) => {
      isDisjoint = isDisjointNow;
    },
  };
}

/** Runs `count` submits `FRAME_PERIOD_MS` apart, the way a steady frame loop would. */
function submitFrames(timer: GpuTimer, clock: ManualClock, count: number): void {
  for (let frame = 0; frame < count; frame += 1) {
    timer.begin();
    timer.end();
    clock.advanceMilliseconds(FRAME_PERIOD_MS);
  }
}

describe('createGpuTimer', () => {
  it('is null without the extension', () => {
    expect(createGpuTimer(fakeContext(false).context, { clock: new ManualClock() })).toBeNull();
  });

  it('brackets each frame in a query, reads results back in order once available and reports their p95', () => {
    const fake = fakeContext();
    const clock = new ManualClock();
    const timer = createGpuTimer(fake.context, { clock })!;
    submitFrames(timer, clock, 4);
    expect(fake.context.beginQuery).toHaveBeenCalledTimes(4);
    expect(timer.p95Ms()).toBeNull();
    expect(timer.status()).toBe(GPU_TIMER_STATUS.pending);
    fake.resolve(1, 5);
    expect(timer.p95Ms(), 'a later query is not read before the one before it').toBeNull();
    fake.resolve(0, 2);
    expect(timer.p95Ms(), 'the first query has no frame period to check, so only the second is a sample').toBe(5);
    fake.resolve(2, 9);
    expect(timer.p95Ms(), 'two samples, interpolated 95 % of the way from 5 to 9').toBeCloseTo(8.8, 9);
  });

  it('drops a sample no frame could have taken and never trusts that context again', () => {
    const fake = fakeContext();
    const clock = new ManualClock();
    const timer = createGpuTimer(fake.context, { clock })!;
    submitFrames(timer, clock, 3);
    fake.resolve(0, 1);
    fake.resolve(1, FRAME_PERIOD_MS * RENDER_GPU_SAMPLE_MAX_FRAME_RATIO + 1);
    expect(timer.p95Ms()).toBeNull();
    expect(timer.status()).toBe(GPU_TIMER_STATUS.implausible);
    expect(timer.implausibleCount).toBe(1);
    fake.resolve(2, 4);
    expect(timer.p95Ms(), 'a plausible sample after an impossible one does not restore trust').toBeNull();
  });

  it('keeps a sample exactly at the ratio the budget allows', () => {
    const fake = fakeContext();
    const clock = new ManualClock();
    const timer = createGpuTimer(fake.context, { clock })!;
    submitFrames(timer, clock, 2);
    fake.resolve(0, 1);
    fake.resolve(1, FRAME_PERIOD_MS * RENDER_GPU_SAMPLE_MAX_FRAME_RATIO);
    expect(timer.p95Ms()).toBe(FRAME_PERIOD_MS * RENDER_GPU_SAMPLE_MAX_FRAME_RATIO);
    expect(timer.status()).toBe(GPU_TIMER_STATUS.ok);
  });

  it('drops the queries in flight when the GPU clock went disjoint, and recycles the query objects', () => {
    const fake = fakeContext();
    const clock = new ManualClock();
    const timer = createGpuTimer(fake.context, { clock })!;
    submitFrames(timer, clock, 2);
    fake.setDisjoint(true);
    fake.resolve(0, 4);
    timer.begin();
    timer.end();
    expect(timer.p95Ms(), 'the two queries the disjoint event spanned were dropped').toBeNull();
    expect(fake.context.createQuery, 'the dropped queries are reused, not recreated').toHaveBeenCalledTimes(2);
    timer.destroy();
    expect(fake.context.deleteQuery).toHaveBeenCalledTimes(2);
    expect(timer.p95Ms()).toBeNull();
  });

  it('keeps only the last `capacity` samples, so `gpuMs` covers the frames the report covers', () => {
    const fake = fakeContext();
    const clock = new ManualClock();
    const timer = createGpuTimer(fake.context, { clock, capacity: 2 })!;
    submitFrames(timer, clock, 4);
    fake.resolve(0, 1);
    fake.resolve(1, 90);
    fake.resolve(2, 3);
    fake.resolve(3, 4);
    expect(timer.p95Ms(), 'the 90 ms sample has fallen out of a two-frame window').toBeLessThan(5);
  });
});
