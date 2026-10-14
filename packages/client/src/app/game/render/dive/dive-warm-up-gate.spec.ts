// @vitest-environment node
// The autoplay's gate past the bands' warm-up (docs/rendering/opening-dive.md §6, ticket #814): one fence, after the
// first frame drawn with every bake landed, and open only while the bakes are and once the GPU is past it.

import { describe, expect, it } from 'vitest';
import { DiveWarmUpGate } from './dive-warm-up-gate';

function gate() {
  const gpu = { isPast: false, fences: 0 };
  const subject = new DiveWarmUpGate();
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

  it('shuts again while a level dropped since bakes again', () => {
    const { subject, gpu, fence } = gate();
    subject.afterFrame(true, fence);
    gpu.isPast = true;
    expect(subject.isOpen(false)).toBe(false);
    expect(subject.isOpen(true)).toBe(true);
  });
});
