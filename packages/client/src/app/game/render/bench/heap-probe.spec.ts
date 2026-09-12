import { describe, expect, it, vi } from 'vitest';
import { NO_HEAP_PROBE, createBrowserHeapProbe } from './heap-probe';

describe('createBrowserHeapProbe', () => {
  it('reads Chrome’s heap counter and runs the exposed collector', () => {
    const collect = vi.fn();
    const probe = createBrowserHeapProbe({ performance: { memory: { usedJSHeapSize: 1234 } }, gc: collect });
    expect(probe.readHeapBytes()).toBe(1234);
    probe.collectGarbage();
    expect(collect).toHaveBeenCalledTimes(1);
  });

  it('reads null and collects nothing where the browser exposes neither', () => {
    const probe = createBrowserHeapProbe({ performance: {} });
    expect(probe.readHeapBytes()).toBeNull();
    expect(() => probe.collectGarbage()).not.toThrow();
    expect(NO_HEAP_PROBE.readHeapBytes()).toBeNull();
  });
});
