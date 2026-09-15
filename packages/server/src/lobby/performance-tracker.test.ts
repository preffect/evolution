import { describe, expect, it } from 'vitest';
import { TICK_HZ, createTestClientPerformanceReport } from '@evolution/shared';
import type { PlayerId } from '@evolution/shared';
import { PerformanceTracker, roundToHundredths, tickRecordOf, type TickRecord } from './performance-tracker.js';

/** More ticks than the tracker's 300-sample window holds, so the oldest have left it. */
const MORE_THAN_THE_WINDOW = 400;
/** Ticks that do not broadcast for each one that does, as at `SNAPSHOT_EVERY_TICKS` = 3. */
const SILENT_TICKS_PER_BROADCAST = 2;
/** Broadcast ticks in the percentile test, costing 1 … 10 ms. */
const BROADCAST_TICK_COUNT = 10;

function tickOf(tickMs: number, snapshotBytes = 100, broadcastClients = 2): TickRecord {
  return { tickMs, broadcastMs: 0, isBroadcastTick: false, snapshotBytes, broadcastClients };
}

function broadcastTickOf(tickMs: number, broadcastMs: number, snapshotBytes = 100): TickRecord {
  return { ...tickOf(tickMs, snapshotBytes), broadcastMs, isBroadcastTick: true };
}

describe('tickRecordOf', () => {
  const readings = { tickStartMs: 10, broadcastStartMs: 13, tickEndMs: 17 };

  it('spans the whole tick and gives the broadcast the time after its start', () => {
    const broadcast = { isBroadcastTick: true, snapshotBytes: 100, broadcastClients: 2 };
    expect(tickRecordOf(readings, broadcast)).toEqual({ tickMs: 7, broadcastMs: 4, ...broadcast });
  });

  it('gives a tick that does not broadcast no broadcast time, even when the clock moved after the step', () => {
    const silent = { isBroadcastTick: false, snapshotBytes: 0, broadcastClients: 2 };
    expect(tickRecordOf(readings, silent)).toEqual({ tickMs: 7, broadcastMs: 0, ...silent });
  });
});

describe('roundToHundredths', () => {
  it('rounds a fraction to two decimal places, so a broken rounding cannot hide behind whole-number averages', () => {
    expect(roundToHundredths(5 / 3)).toBe(1.67);
    expect(roundToHundredths(2 / 3)).toBe(0.67);
    expect(roundToHundredths(1 / 8)).toBe(0.13);
  });
});

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

  it('averages the broadcast over every tick, the silent ones included', () => {
    const tracker = new PerformanceTracker();
    tracker.recordTick(tickOf(1));
    tracker.recordTick(tickOf(1));
    tracker.recordTick(broadcastTickOf(7, 6));
    expect(tracker.getStats()).toMatchObject({ tickAvgMs: 3, tickPeakMs: 7, broadcastAvgMs: 2, broadcastPeakMs: 6 });
  });

  it('takes the broadcast p95 over the broadcast ticks only, so the silent zeros never pull it down', () => {
    const tracker = new PerformanceTracker();
    for (let broadcastMs = 1; broadcastMs <= BROADCAST_TICK_COUNT; broadcastMs += 1) {
      for (let silent = 0; silent < SILENT_TICKS_PER_BROADCAST; silent += 1) tracker.recordTick(tickOf(1));
      tracker.recordTick(broadcastTickOf(1 + broadcastMs, broadcastMs));
    }
    // Over all 30 ticks the p95 would be 9 ms; over the 10 broadcast ticks it is the slowest, 10 ms.
    expect(tracker.getStats().broadcastP95Ms).toBe(BROADCAST_TICK_COUNT);
  });

  it('counts a broadcast tick that sent no bytes, and reports a p95 of 0 for a window without one', () => {
    const tracker = new PerformanceTracker();
    tracker.recordTick(tickOf(1));
    expect(tracker.getStats().broadcastP95Ms).toBe(0);
    tracker.recordTick(broadcastTickOf(4, 3, 0));
    expect(tracker.getStats().broadcastP95Ms).toBe(3);
  });

  it('keeps the worst broadcast even when it was not the worst tick, after it leaves the window', () => {
    const tracker = new PerformanceTracker();
    tracker.recordTick(broadcastTickOf(5, 4));
    tracker.recordTick(tickOf(9));
    for (let index = 0; index < MORE_THAN_THE_WINDOW; index++) tracker.recordTick(tickOf(1));
    expect(tracker.getStats()).toMatchObject({
      tickPeakMs: 9,
      broadcastAvgMs: 0,
      broadcastP95Ms: 0,
      broadcastPeakMs: 4,
    });
  });

  it('keeps a bounded window but never forgets the worst tick', () => {
    const tracker = new PerformanceTracker();
    tracker.recordTick(tickOf(50));
    for (let index = 0; index < MORE_THAN_THE_WINDOW; index++) tracker.recordTick(tickOf(1));
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
