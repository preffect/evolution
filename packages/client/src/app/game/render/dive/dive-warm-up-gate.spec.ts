// @vitest-environment node
// The autoplay's gate past the bands' warm-up (docs/rendering/opening-dive.md §1, ticket #814): one fence, after the
// first frame drawn with every bake landed, and open only while the bakes are and once the GPU is past it, or once the
// most it waits has passed.

import { describe, expect, it } from 'vitest';
import { DIVE_WARM_UP_MAX_WAIT_MS } from '../constants';
import { DiveWarmUpGate } from './dive-warm-up-gate';

function gate() {
  const gpu = { isPast: false, fences: 0, nowMs: 0 };
  const subject = new DiveWarmUpGate(() => gpu.nowMs);
  const fence = () => {
    gpu.fences += 1;
    return () => gpu.isPast;
  };
  return { subject, gpu, fence };
}

describe('DiveWarmUpGate', () => {
  it('sets no fence and stays shut while a bake is still out', () => {
    const { subject, gpu, fence } = gate();
    subject.afterFrame(false, fence);
    gpu.isPast = true;
    expect(subject.isOpen(true)).toBe(false);
    expect(gpu.fences).toBe(0);
  });

  it('fences the first frame drawn with every bake landed, once, and opens when the GPU is past it', () => {
    const { subject, gpu, fence } = gate();
    subject.afterFrame(true, fence);
    subject.afterFrame(true, fence);
    expect(gpu.fences).toBe(1);
    expect(subject.isOpen(true)).toBe(false);
    gpu.isPast = true;
    expect(subject.isOpen(true)).toBe(true);
  });

  it('opens once the most it waits has passed since the fence, though the GPU is not past it', () => {
    const { subject, gpu, fence } = gate();
    gpu.nowMs = 1000;
    subject.afterFrame(true, fence);
    gpu.nowMs += DIVE_WARM_UP_MAX_WAIT_MS - 1;
    expect(subject.isOpen(true)).toBe(false);
    gpu.nowMs += 1;
    expect(subject.isOpen(true)).toBe(true);
    expect(subject.isOpen(false)).toBe(false);
  });

  it('is warming up from its fence until the GPU is past it or the wait is over, and never before the fence', () => {
    const { subject, gpu, fence } = gate();
    expect(subject.isWarmingUp).toBe(false);
    subject.afterFrame(true, fence);
    expect(subject.isWarmingUp).toBe(true);
    gpu.isPast = true;
    expect(subject.isWarmingUp).toBe(false);
    const timedOut = gate();
    timedOut.subject.afterFrame(true, timedOut.fence);
    timedOut.gpu.nowMs += DIVE_WARM_UP_MAX_WAIT_MS;
    expect(timedOut.subject.isWarmingUp).toBe(false);
  });

  it('shuts again while a level dropped since bakes again', () => {
    const { subject, gpu, fence } = gate();
    subject.afterFrame(true, fence);
    gpu.isPast = true;
    expect(subject.isOpen(false)).toBe(false);
    expect(subject.isOpen(true)).toBe(true);
  });
});
