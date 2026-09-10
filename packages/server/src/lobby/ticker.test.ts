import { afterEach, describe, expect, it, vi } from 'vitest';
import { TICK_INTERVAL_MS } from '@evolution/shared';
import { IntervalTicker, ManualTicker } from './ticker.js';

describe('IntervalTicker', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires the callback on every interval once started and never after stop()', () => {
    vi.useFakeTimers();
    const onTick = vi.fn();
    const ticker = new IntervalTicker();
    ticker.start(onTick);
    ticker.start(onTick);
    vi.advanceTimersByTime(TICK_INTERVAL_MS * 3 + 1);
    const firesWhileStarted = onTick.mock.calls.length;
    expect(firesWhileStarted).toBeGreaterThanOrEqual(3);
    ticker.stop();
    ticker.stop();
    vi.advanceTimersByTime(TICK_INTERVAL_MS * 10);
    expect(onTick).toHaveBeenCalledTimes(firesWhileStarted);
  });

  it('accepts a custom interval', () => {
    vi.useFakeTimers();
    const onTick = vi.fn();
    new IntervalTicker(100).start(onTick);
    vi.advanceTimersByTime(250);
    expect(onTick).toHaveBeenCalledTimes(2);
  });
});

describe('ManualTicker', () => {
  it('fires only while started, as many times as asked', () => {
    const onTick = vi.fn();
    const ticker = new ManualTicker();
    ticker.fire();
    expect(onTick).not.toHaveBeenCalled();
    ticker.start(onTick);
    expect(ticker.isStarted()).toBe(true);
    ticker.fire(3);
    ticker.fire();
    expect(onTick).toHaveBeenCalledTimes(4);
    ticker.stop();
    ticker.fire();
    expect(ticker.isStarted()).toBe(false);
    expect(onTick).toHaveBeenCalledTimes(4);
  });
});
