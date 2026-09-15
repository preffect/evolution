import { describe, expect, it } from 'vitest';
import { TICK_HZ, createTestClientPerformanceReport } from '@evolution/shared';
import type { PlayerId } from '@evolution/shared';
import { PerformanceTracker } from './performance-tracker.js';

function tickOf(tickMs: number, snapshotBytes = 100, broadcastClients = 2, broadcastMs = 0) {
  return { tickMs, broadcastMs, snapshotBytes, broadcastClients };
}

describe('PerformanceTracker', () => {
  it('reports zeros before any tick was recorded', () => {
    expect(new PerformanceTracker().getStats()).toEqual({
      sampleCount: 0,
      tickAvgMs: 0,
      tickP95Ms: 0,
      tickPeakMs: 0,
      broadcastAvgMs: 0,
      broadcastP95Ms: 0,
      broadcastPeakMs: 0,
      broadcastBytesPerSec: 0,
      droppedTicks: 0,
      worstTick: null,
    });
  });

  it('accumulates dropped ticks across fires', () => {
    const tracker = new PerformanceTracker();
    tracker.recordTick(tickOf(1));
    tracker.recordDroppedTicks(2);
    tracker.recordDroppedTicks(3);
    expect(tracker.getStats().droppedTicks).toBe(5);
  });

  it('averages tick times, keeps the worst tick and scales bytes by the tick rate', () => {
    const tracker = new PerformanceTracker();
    tracker.recordTick(tickOf(1));
    tracker.recordTick(tickOf(3));
    const stats = tracker.getStats();
    expect(stats).toMatchObject({ sampleCount: 2, tickAvgMs: 2, tickPeakMs: 3, worstTick: tickOf(3) });
    expect(stats.broadcastBytesPerSec).toBe(100 * 2 * TICK_HZ);
    expect(tracker.stats).toEqual(stats);
    expect(tracker.worstTick()).toEqual(tickOf(3));
  });

  it('summarises the broadcast share over every tick, the silent ones included', () => {
    const tracker = new PerformanceTracker();
    tracker.recordTick(tickOf(1));
    tracker.recordTick(tickOf(1));
    tracker.recordTick(tickOf(7, 100, 2, 6));
    expect(tracker.getStats()).toMatchObject({
      tickAvgMs: 3,
      tickPeakMs: 7,
      broadcastAvgMs: 2,
      broadcastP95Ms: 6,
      broadcastPeakMs: 6,
    });
  });

  it('keeps the worst broadcast even when it was not the worst tick, after it leaves the window', () => {
    const tracker = new PerformanceTracker();
    tracker.recordTick(tickOf(5, 100, 2, 4));
    tracker.recordTick(tickOf(9));
    for (let index = 0; index < 400; index++) tracker.recordTick(tickOf(1));
    const stats = tracker.getStats();
    expect(stats).toMatchObject({ tickPeakMs: 9, broadcastAvgMs: 0, broadcastPeakMs: 4 });
  });

  it('keeps a bounded window but never forgets the worst tick', () => {
    const tracker = new PerformanceTracker();
    tracker.recordTick(tickOf(50));
    for (let index = 0; index < 400; index++) tracker.recordTick(tickOf(1));
    const stats = tracker.getStats();
    expect(stats.sampleCount).toBeLessThanOrEqual(300);
    expect(stats.tickAvgMs).toBe(1);
    expect(stats.tickPeakMs).toBe(50);
  });

  it('stores and forgets client reports by player', () => {
    const tracker = new PerformanceTracker();
    const report = createTestClientPerformanceReport({ frameTimeAvgMs: 16, frameTimeP95Ms: 20, frameTimePeakMs: 30 });
    tracker.recordClientReport('p1' as PlayerId, report);
    expect(tracker.clientReportsSnapshot()).toEqual({ p1: report });
    tracker.removeClient('p1' as PlayerId);
    expect(tracker.clientReportsSnapshot()).toEqual({});
  });
});
