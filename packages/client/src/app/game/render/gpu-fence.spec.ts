// @vitest-environment node
// The GPU fence (docs/rendering/opening-dive.md §6, ticket #814): its check reads the fence's status and never blocks,
// passes for good once the GPU is past it (the fence then given back), and passes at once where no fence can be set.

import { describe, expect, it } from 'vitest';
import { fenceGpuWork, type GpuFenceContext } from './gpu-fence';

const SYNC = {} as WebGLSync;
/** The WebGL 2 enums a fence reads (their values from the WebGL 2 spec), off the context as the browser's are. */
const SYNC_STATUS = 0x9114;
const SIGNALED = 0x9119;
const UNSIGNALED = 0x9118;
const SYNC_ENUMS = Object.fromEntries([
  ['SYNC_GPU_COMMANDS_COMPLETE', 0x9117],
  ['SYNC_STATUS', SYNC_STATUS],
  ['UNSIGNALED', UNSIGNALED],
]);

/**
 * A WebGL 2 context whose GPU is past the fence once `gpu.isDone`, and whose fence is invalid (a context lost and
 * restored since) once `gpu.isInvalid`; it records what it was asked.
 */
function context(gpu = { isDone: false, isLost: false, isInvalid: false }) {
  const calls: string[] = [];
  const methods: Pick<GpuFenceContext, 'fenceSync' | 'getSyncParameter' | 'deleteSync' | 'flush' | 'isContextLost'> = {
    fenceSync: () => {
      calls.push('fence');
      return SYNC;
    },
    getSyncParameter: (_sync, name) => {
      calls.push('status');
      if (gpu.isInvalid) return null;
      return name === SYNC_STATUS && gpu.isDone ? SIGNALED : UNSIGNALED;
    },
    deleteSync: () => calls.push('delete'),
    flush: () => calls.push('flush'),
    isContextLost: () => gpu.isLost,
  };
  const subject = { ...SYNC_ENUMS, ...methods } as GpuFenceContext;
  return { subject, calls, gpu };
}

describe('fenceGpuWork', () => {
  it('fences the work so far and flushes it, then passes only once the GPU is past it', () => {
    const { subject, calls, gpu } = context();
    const check = fenceGpuWork(subject);
    expect(calls).toEqual(['fence', 'flush']);
    expect(check()).toBe(false);
    expect(check()).toBe(false);
    gpu.isDone = true;
    expect(check()).toBe(true);
    expect(calls.filter((call) => call === 'delete')).toHaveLength(1);
  });

  it('stays passed without asking again, the fence given back once', () => {
    const { subject, calls, gpu } = context({ isDone: true, isLost: false, isInvalid: false });
    const check = fenceGpuWork(subject);
    expect(check()).toBe(true);
    const asked = calls.length;
    expect(check()).toBe(true);
    expect(calls).toHaveLength(asked);
    gpu.isDone = false;
    expect(check()).toBe(true);
  });

  it('passes once the context is lost: no fence of it will ever signal', () => {
    const { subject, gpu } = context();
    const check = fenceGpuWork(subject);
    gpu.isLost = true;
    expect(check()).toBe(true);
  });

  it('passes once its fence is invalid: a context lost and restored since reads its status as null, never signalled', () => {
    const { subject, gpu } = context();
    const check = fenceGpuWork(subject);
    expect(check()).toBe(false);
    gpu.isInvalid = true;
    expect(check()).toBe(true);
  });

  it('passes at once where no fence can be set: no WebGL 2, a lost context, no sync made, no context', () => {
    const { subject, calls } = context({ isDone: false, isLost: true, isInvalid: false });
    expect(fenceGpuWork(subject)()).toBe(true);
    expect(calls).toEqual([]);
    const webGl1: Partial<GpuFenceContext> = { flush: () => undefined, isContextLost: () => false };
    expect(fenceGpuWork(webGl1)()).toBe(true);
    expect(fenceGpuWork({ ...context().subject, fenceSync: () => null })()).toBe(true);
    expect(fenceGpuWork(null)()).toBe(true);
  });
});
