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
  /** Whether the tick broadcast, even to no targets: `snapshotBytes` alone cannot tell (#340). */
  isBroadcastTick: boolean;
  /** One client's `game_snapshot` bytes: the mean over the clients when each is sent its own (`viewer-snapshots.ts`). */
  snapshotBytes: number;
  broadcastClients: number;
  /** Optional free-form counts a game may report (e.g. { entities: 12 }). */
  entities?: Record<string, number>;
}

/** The room clock read three times in one tick (#340): before the step, before the broadcast, after both. */
export interface TickClockReadings {
  readonly tickStartMs: number;
  readonly broadcastStartMs: number;
  readonly tickEndMs: number;
}

/** What the tick did on the wire: the part of a `TickRecord` the clock does not give. */
export type TickBroadcast = Pick<TickRecord, 'isBroadcastTick' | 'snapshotBytes' | 'broadcastClients'>;

/** One tick's record from its readings: `broadcastMs` is exactly 0 on a silent tick, whatever the clock did. */
export function tickRecordOf(readings: TickClockReadings, broadcast: TickBroadcast): TickRecord {
  const broadcastMs = broadcast.isBroadcastTick ? readings.tickEndMs - readings.broadcastStartMs : 0;
  return { tickMs: readings.tickEndMs - readings.tickStartMs, broadcastMs, ...broadcast };
}

export interface PerformanceStats {
  sampleCount: number;
  tickAvgMs: number;
  tickP95Ms: number;
  tickPeakMs: number;
  /** Over every tick in the window, the silent ones included: the broadcast's share of `tickAvgMs`. */
  broadcastAvgMs: number;
  /** Over the broadcast ticks in the window only (0 when there are none): does a broadcasting tick fit the step. */
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

/** Rounds a millisecond or byte-rate reading to the hundredths every tracker figure is reported in. */
export function roundToHundredths(value: number): number {
  return Math.round(value * HUNDREDTHS) / HUNDREDTHS;
}

/** The rounded mean of a non-empty sample list. */
function meanOf(samples: readonly number[]): number {
  return roundToHundredths(samples.reduce((sum, sample) => sum + sample, 0) / samples.length);
}

/** The rounded 95th percentile of a sample list; 0 for an empty one. */
function p95Of(samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((left, right) => left - right);
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * P95_QUANTILE));
  return roundToHundredths(sorted[p95Index] ?? 0);
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
    const tickTimes = this.ticks.map((record) => record.tickMs);
    const broadcastTickTimes = this.ticks
      .filter((record) => record.isBroadcastTick)
      .map((record) => record.broadcastMs);
    // Approximate broadcast bytes/sec from average snapshot size * clients at the tick rate.
    const totalBytes = this.ticks.reduce((sum, record) => sum + record.snapshotBytes * record.broadcastClients, 0);
    return {
      sampleCount,
      tickAvgMs: meanOf(tickTimes),
      tickP95Ms: p95Of(tickTimes),
      tickPeakMs: roundToHundredths(this.worst?.tickMs ?? 0),
      broadcastAvgMs: meanOf(this.ticks.map((record) => record.broadcastMs)),
      broadcastP95Ms: p95Of(broadcastTickTimes),
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
