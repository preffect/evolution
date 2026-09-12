import { describe, expect, it, vi } from 'vitest';
import { createGpuTimer, type GpuTimerSource } from './gpu-timer';

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
    createQuery: () => {
      const query: FakeQuery = { isAvailable: false, nanoseconds: 0 };
      queries.push(query);
      return query as unknown as WebGLQuery;
    },
    beginQuery: vi.fn(),
    endQuery: vi.fn(),
    getQueryParameter: (query: WebGLQuery, name: number) => {
      const fake = query as unknown as FakeQuery;
      return name === QUERY_RESULT_AVAILABLE ? fake.isAvailable : fake.nanoseconds;
    },
    deleteQuery: vi.fn(),
  } as unknown as GpuTimerSource & { deleteQuery: ReturnType<typeof vi.fn>; beginQuery: ReturnType<typeof vi.fn> };
  return {
    context,
    queries,
    resolve: (index: number, milliseconds: number) => {
      queries[index]!.isAvailable = true;
      queries[index]!.nanoseconds = milliseconds * 1_000_000;
    },
    setDisjoint: (isDisjointNow: boolean) => {
      isDisjoint = isDisjointNow;
    },
  };
}

describe('createGpuTimer', () => {
  it('is null without the extension', () => {
    expect(createGpuTimer(fakeContext(false).context)).toBeNull();
  });

  it('brackets each frame in a query, reads results back in order once available and reports their p95', () => {
    const fake = fakeContext();
    const timer = createGpuTimer(fake.context)!;
    for (let frame = 0; frame < 3; frame += 1) {
      timer.begin();
      timer.end();
    }
    expect(fake.context.beginQuery).toHaveBeenCalledTimes(3);
    expect(timer.p95Ms()).toBeNull();
    fake.resolve(1, 5);
    expect(timer.p95Ms()).toBeNull();
    fake.resolve(0, 2);
    expect(timer.p95Ms()).toBe(5);
    expect(fake.context.deleteQuery).toHaveBeenCalledTimes(2);
    fake.resolve(2, 9);
    expect(timer.p95Ms()).toBe(9);
  });

  it('drops a result taken while the GPU clock was disjoint and frees the queries on destroy', () => {
    const fake = fakeContext();
    const timer = createGpuTimer(fake.context)!;
    timer.begin();
    timer.end();
    timer.begin();
    timer.end();
    fake.setDisjoint(true);
    fake.resolve(0, 4);
    expect(timer.p95Ms()).toBeNull();
    timer.destroy();
    expect(fake.context.deleteQuery).toHaveBeenCalledTimes(2);
    expect(timer.p95Ms()).toBeNull();
  });
});
