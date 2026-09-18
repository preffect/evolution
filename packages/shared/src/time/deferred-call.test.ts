import { describe, expect, it, vi } from 'vitest';
import { ManualScheduler, SystemScheduler } from './deferred-call.js';

const DELAY_MS = 150;

describe('ManualScheduler', () => {
  it('runs nothing until time reaches the call, and then runs it once', () => {
    const scheduler = new ManualScheduler();
    const ran: string[] = [];
    scheduler.after(DELAY_MS, () => ran.push('settled'));

    scheduler.advanceMilliseconds(DELAY_MS - 1);
    expect(ran).toEqual([]);

    scheduler.advanceMilliseconds(1);
    expect(ran).toEqual(['settled']);

    scheduler.advanceMilliseconds(DELAY_MS);
    expect(ran).toEqual(['settled']);
  });

  it('runs due calls oldest first', () => {
    const scheduler = new ManualScheduler();
    const ran: string[] = [];
    scheduler.after(DELAY_MS, () => ran.push('first'));
    scheduler.after(DELAY_MS, () => ran.push('second'));
    scheduler.advanceMilliseconds(DELAY_MS);
    expect(ran).toEqual(['first', 'second']);
  });

  /** A debounce is exactly this: the pending call is dropped and a later one takes its place. */
  it('drops a cancelled call, and cancelling twice is harmless', () => {
    const scheduler = new ManualScheduler();
    const ran: string[] = [];
    const cancel = scheduler.after(DELAY_MS, () => ran.push('dropped'));
    cancel();
    cancel();
    expect(scheduler.pendingCallCount).toBe(0);
    scheduler.advanceMilliseconds(DELAY_MS);
    expect(ran).toEqual([]);
  });

  /** A call made by a due call waits for the next advance: a callback can reschedule without looping forever. */
  it('does not run a call scheduled from inside a due call in the same advance', () => {
    const scheduler = new ManualScheduler();
    const ran: string[] = [];
    scheduler.after(DELAY_MS, () => {
      ran.push('outer');
      scheduler.after(0, () => ran.push('inner'));
    });
    scheduler.advanceMilliseconds(DELAY_MS);
    expect(ran).toEqual(['outer']);

    scheduler.advanceMilliseconds(0);
    expect(ran).toEqual(['outer', 'inner']);
  });
});

describe('SystemScheduler', () => {
  it('defers the call by the delay it is given, and cancels it before it runs', () => {
    vi.useFakeTimers();
    try {
      const scheduler = new SystemScheduler();
      const ran: string[] = [];
      scheduler.after(DELAY_MS, () => ran.push('settled'));
      const cancel = scheduler.after(DELAY_MS, () => ran.push('cancelled'));
      cancel();

      vi.advanceTimersByTime(DELAY_MS - 1);
      expect(ran).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(ran).toEqual(['settled']);
    } finally {
      vi.useRealTimers();
    }
  });
});
