import type { ClientPerformanceReport, PlayerId } from '@evolution/shared';
import { TICK_HZ } from '@evolution/shared';

const SAMPLE_CAPACITY = 300;
const P95_QUANTILE = 0.95;
const HUNDREDTHS = 100;

/** One server tick's measurements. Game-agnostic. */
export interface TickRecord {
  tickMs: number;
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
  broadcastBytesPerSec: number;
  worstTick: TickRecord | null;
}

const EMPTY_STATS: PerformanceStats = {
  sampleCount: 0,
  tickAvgMs: 0,
  tickP95Ms: 0,
  tickPeakMs: 0,
  broadcastBytesPerSec: 0,
  worstTick: null,
};

function roundToHundredths(value: number): number {
  return Math.round(value * HUNDREDTHS) / HUNDREDTHS;
}

/**
 * Server-side tick telemetry with a fixed ring buffer, plus a per-client
 * performance-report store. Fully game-agnostic.
 */
export class PerformanceTracker {
  private readonly ticks: TickRecord[] = [];
  private cursor = 0;
  private worst: TickRecord | null = null;
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
    const tickTimes = this.ticks.map((record) => record.tickMs).sort((left, right) => left - right);
    const totalMs = tickTimes.reduce((sum, tickMs) => sum + tickMs, 0);
    const p95Index = Math.min(sampleCount - 1, Math.floor(sampleCount * P95_QUANTILE));
    // Approximate broadcast bytes/sec from average snapshot size * clients at the tick rate.
    const totalBytes = this.ticks.reduce((sum, record) => sum + record.snapshotBytes * record.broadcastClients, 0);
    return {
      sampleCount,
      tickAvgMs: roundToHundredths(totalMs / sampleCount),
      tickP95Ms: roundToHundredths(tickTimes[p95Index] ?? 0),
      tickPeakMs: roundToHundredths(this.worst?.tickMs ?? 0),
      broadcastBytesPerSec: roundToHundredths((totalBytes / sampleCount) * TICK_HZ),
      worstTick: this.worst,
    };
  }

  /** Convenience accessor used by MCP performance handlers. */
  get stats(): PerformanceStats {
    return this.getStats();
  }
}
