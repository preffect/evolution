import type { ClientPerformanceReport, PlayerId } from '@evolution/shared';
import { P95_QUANTILE, TICK_HZ } from '@evolution/shared';

const SAMPLE_CAPACITY = 300;
const HUNDREDTHS = 100;

/** One server tick's measurements. Game-agnostic. */
export interface TickRecord {
  /** The whole tick: the simulation step and, on a broadcast tick, the broadcast (#340). */
  tickMs: number;
  /** The part of `tickMs` spent serialising and sending the snapshot; 0 on a tick that does not broadcast. */
  broadcastMs: number;
  /** One client's `game_snapshot` bytes: the mean over the clients when each is sent its own (`viewer-snapshots.ts`). */
  snapshotBytes: number;
  broadcastClients: number;
  /** Optional free-form counts a game may report (e.g. { entities: 12 }). */
  entities?: Record<string, number>;
}

export interface PerformanceStats {
  sampleCount: number;
  tickAvgMs: number;
  tickP95Ms: number;
  tickPeakMs: number;
  /** Over every tick in the window, the zero-cost non-broadcast ticks included, like `tickAvgMs`. */
  broadcastAvgMs: number;
  broadcastP95Ms: number;
  broadcastPeakMs: number;
  broadcastBytesPerSec: number;
  /** Ticks the fixed-step cap discarded after stalls (docs/determinism/contract-and-clock.md §2); cumulative. */
  droppedTicks: number;
  worstTick: TickRecord | null;
}

/** Shared by every empty tracker, so frozen: a caller must not be able to corrupt another room's stats. */
const EMPTY_STATS: PerformanceStats = Object.freeze({
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

function roundToHundredths(value: number): number {
  return Math.round(value * HUNDREDTHS) / HUNDREDTHS;
}

/** Mean and p95 of a non-empty sample window, rounded like every other reported figure. */
function summarise(samples: readonly number[]): { avgMs: number; p95Ms: number } {
  const sorted = [...samples].sort((left, right) => left - right);
  const total = sorted.reduce((sum, sample) => sum + sample, 0);
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * P95_QUANTILE));
  return { avgMs: roundToHundredths(total / sorted.length), p95Ms: roundToHundredths(sorted[p95Index] ?? 0) };
}

/**
 * Server-side tick telemetry with a fixed ring buffer, plus a per-client
 * performance-report store. Fully game-agnostic.
 */
export class PerformanceTracker {
  private readonly ticks: TickRecord[] = [];
  private cursor = 0;
  private worst: TickRecord | null = null;
  private worstBroadcastMs = 0;
  private droppedTickTotal = 0;
  private readonly clientReports = new Map<string, ClientPerformanceReport>();

  recordTick(record: TickRecord): void {
    if (this.ticks.length < SAMPLE_CAPACITY) {
      this.ticks.push(record);
    } else {
      this.ticks[this.cursor] = record;
      this.cursor = (this.cursor + 1) % SAMPLE_CAPACITY;
    }
    if (!this.worst || record.tickMs > this.worst.tickMs) {
      this.worst = record;
    }
    this.worstBroadcastMs = Math.max(this.worstBroadcastMs, record.broadcastMs);
  }

  /** A capped catch-up always runs `MAX_TICKS_PER_ADVANCE` ticks too, so drops never precede the first sample. */
  recordDroppedTicks(count: number): void {
    this.droppedTickTotal += count;
  }

  worstTick(): TickRecord | null {
    return this.worst;
  }

  recordClientReport(playerId: PlayerId, report: ClientPerformanceReport): void {
    this.clientReports.set(playerId, report);
  }

  removeClient(playerId: PlayerId): void {
    this.clientReports.delete(playerId);
  }

  clientReportsSnapshot(): Record<string, ClientPerformanceReport> {
    return Object.fromEntries(this.clientReports);
  }

  getStats(): PerformanceStats {
    const sampleCount = this.ticks.length;
    if (sampleCount === 0) return EMPTY_STATS;
    const tick = summarise(this.ticks.map((record) => record.tickMs));
    const broadcast = summarise(this.ticks.map((record) => record.broadcastMs));
    // Approximate broadcast bytes/sec from average snapshot size * clients at the tick rate.
    const totalBytes = this.ticks.reduce((sum, record) => sum + record.snapshotBytes * record.broadcastClients, 0);
    return {
      sampleCount,
      tickAvgMs: tick.avgMs,
      tickP95Ms: tick.p95Ms,
      tickPeakMs: roundToHundredths(this.worst?.tickMs ?? 0),
      broadcastAvgMs: broadcast.avgMs,
      broadcastP95Ms: broadcast.p95Ms,
      broadcastPeakMs: roundToHundredths(this.worstBroadcastMs),
      broadcastBytesPerSec: roundToHundredths((totalBytes / sampleCount) * TICK_HZ),
      droppedTicks: this.droppedTickTotal,
      worstTick: this.worst,
    };
  }

  /** Convenience accessor used by MCP performance handlers. */
  get stats(): PerformanceStats {
    return this.getStats();
  }
}
