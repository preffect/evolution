// @vitest-environment node
// The dive's bake slices timed (docs/rendering/opening-dive.md §6, ticket #814): each call the wrapped scheduler runs
// is counted on the clock, one that throws too, and a cancelled one never runs.

import { ManualClock, ManualScheduler } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { DiveBakeTime } from './dive-bake-time';

const SLICE_MS = 8;

function timed() {
  const clock = new ManualClock(0);
  const scheduler = new ManualScheduler();
  const subject = new DiveBakeTime(clock);
  return { clock, scheduler, subject, bakes: subject.timed(scheduler) };
}

describe('DiveBakeTime', () => {
  it('adds up the time of every slice the scheduler runs, and nothing between them', () => {
    const { clock, scheduler, subject, bakes } = timed();
    bakes.after(10, () => clock.advanceMilliseconds(SLICE_MS));
    bakes.after(20, () => clock.advanceMilliseconds(SLICE_MS * 2));
    clock.advanceMilliseconds(500);
    scheduler.advanceMilliseconds(10);
    expect(subject.totalMs).toBe(SLICE_MS);
    scheduler.advanceMilliseconds(10);
    expect(subject.totalMs).toBe(SLICE_MS * 3);
  });

  it('counts a slice that throws, and lets the error through', () => {
    const { clock, scheduler, subject, bakes } = timed();
    bakes.after(0, () => {
      clock.advanceMilliseconds(SLICE_MS);
      throw new Error('bake failed');
    });
    expect(() => scheduler.advanceMilliseconds(0)).toThrow('bake failed');
    expect(subject.totalMs).toBe(SLICE_MS);
  });

  it('cancels as the scheduler does: a slice cancelled never runs nor counts', () => {
    const { clock, scheduler, subject, bakes } = timed();
    let hasRun = false;
    const cancel = bakes.after(10, () => {
      hasRun = true;
      clock.advanceMilliseconds(SLICE_MS);
    });
    cancel();
    scheduler.advanceMilliseconds(10);
    expect(hasRun).toBe(false);
    expect(subject.totalMs).toBe(0);
  });
});
