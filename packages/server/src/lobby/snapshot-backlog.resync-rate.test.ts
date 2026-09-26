// The resync-rate bound docs/architecture/wire-contract.md §4.1 states (#277): an acknowledging client cannot be
// resynced more often than it can fall a whole limit behind again, `SNAPSHOT_BACKLOG_LIMIT_TICKS` of room time or
// `SNAPSHOT_BACKLOG_LIMIT_BYTES` of deltas sent to it. Two things rest on it: the bandwidth a struggling client is sent,
// and the client's effect bound, which a resync switches off for a buffer's worth of broadcasts (#284). So the client
// here is the worst one the room can meet: it acknowledges only what earns it the next resync soonest.

import { describe, expect, it } from 'vitest';
import {
  BYTES_PER_KIBIBYTE,
  SNAPSHOT_BACKLOG_LIMIT_BYTES,
  SNAPSHOT_BACKLOG_LIMIT_TICKS,
  SNAPSHOT_EVERY_TICKS,
} from '@evolution/shared';
import { SNAPSHOT_DELIVERY, SnapshotBacklog } from './snapshot-backlog.js';
import { createTestConnection, setBufferedAmount } from '../testing/builders.js';

const PLAYER_ID = 'p1';
const FIRST_TICK = 1;
/** Long enough for a dozen falls behind at the slowest of them. */
const BROADCASTS = 1_000;
/** §4.1's worst case over budget: a delta this size fills the byte limit before the tick one. */
const OVER_BUDGET_DELTA_BYTES = 40 * BYTES_PER_KIBIBYTE;
/** About three deltas (§4): what a `game_state` weighs on the socket. */
const RESYNC_BYTES = 3 * OVER_BUDGET_DELTA_BYTES;
/** Resyncs a run must see, or it proved nothing about the gap between them. */
const MIN_RESYNCS = 5;
/** Broadcasts a `game_state` can sit behind older deltas before its ack arrives (#275). */
const RESYNC_ACK_DELAYS = [0, 1, 2, 5] as const;

interface LaggingClientOptions {
  readonly isRoomPaused: boolean;
  /** Broadcasts between a resync and its ack. */
  readonly resyncAckDelay: number;
  /** Bytes per delta when the socket holds what the client has not acknowledged; without it the socket drains. */
  readonly deltaBytes?: number;
}

/** What the room sent the client between two resyncs. */
interface ResyncGap {
  readonly ticks: number;
  readonly deltaBytes: number;
}

interface SentMessage {
  readonly tick: number;
  readonly bytes: number;
}

/** Bytes of the messages sent after `tick`: all a socket can hold once the client has acknowledged `tick`. */
function bytesSentAfter(sent: readonly SentMessage[], tick: number): number {
  return sent.filter((message) => message.tick > tick).reduce((sum, message) => sum + message.bytes, 0);
}

/**
 * The oldest tick a skipped client can acknowledge and be caught up: no deeper than the limit, and a socket holding no
 * more than the limit. Acknowledging any newer would only restart its measurement sooner.
 */
function barelyCaughtUpTick(sent: readonly SentMessage[], isSocketHolding: boolean): number {
  const newestTick = sent.at(-1)?.tick ?? FIRST_TICK;
  const caughtUp = sent.find(
    ({ tick }) =>
      newestTick - tick <= SNAPSHOT_BACKLOG_LIMIT_TICKS &&
      (!isSocketHolding || bytesSentAfter(sent, tick) <= SNAPSHOT_BACKLOG_LIMIT_BYTES),
  );
  return caughtUp?.tick ?? newestTick;
}

/**
 * The worst client against one backlog: it acknowledges its first delta, each resync `resyncAckDelay` broadcasts late,
 * and, whenever it is skipped, only just enough to be caught up and due a resync at once. Its socket holds every byte
 * sent after the newest message it acknowledged.
 */
class WorstLaggingClient {
  readonly gaps: ResyncGap[] = [];
  private readonly backlog = new SnapshotBacklog();
  private readonly connection = createTestConnection({ playerId: PLAYER_ID });
  private readonly sent: SentMessage[] = [];
  private acknowledgedTick = FIRST_TICK;
  private resyncAckDue: { broadcast: number; tick: number } | undefined;
  private previousResyncTick: number | undefined;
  private deltaBytesSinceResync = 0;

  constructor(private readonly options: LaggingClientOptions) {}

  broadcast(broadcast: number): void {
    const tick = FIRST_TICK + broadcast * SNAPSHOT_EVERY_TICKS;
    if (this.resyncAckDue !== undefined && this.resyncAckDue.broadcast <= broadcast) {
      this.acknowledge(this.resyncAckDue.tick);
      this.resyncAckDue = undefined;
    }
    this.holdUnacknowledgedBytes();
    const delivery = this.backlog.nextFor(this.connection, tick, this.options.isRoomPaused);
    if (delivery === SNAPSHOT_DELIVERY.delta) this.receiveDelta(tick);
    else if (delivery === SNAPSHOT_DELIVERY.resync) this.receiveResync(broadcast, tick);
    else this.catchUpBarely(broadcast, tick);
  }

  private receiveDelta(tick: number): void {
    const bytes = this.options.deltaBytes ?? 0;
    this.sent.push({ tick, bytes });
    this.deltaBytesSinceResync += bytes;
    if (tick === FIRST_TICK) this.acknowledge(tick);
  }

  private receiveResync(broadcast: number, tick: number): void {
    if (this.previousResyncTick !== undefined) {
      this.gaps.push({ ticks: tick - this.previousResyncTick, deltaBytes: this.deltaBytesSinceResync });
    }
    this.previousResyncTick = tick;
    this.deltaBytesSinceResync = 0;
    this.sent.push({ tick, bytes: RESYNC_BYTES });
    this.resyncAckDue = { broadcast: broadcast + this.options.resyncAckDelay, tick };
  }

  private catchUpBarely(broadcast: number, tick: number): void {
    this.acknowledge(barelyCaughtUpTick(this.sent, this.isSocketHolding()));
    this.holdUnacknowledgedBytes();
    // A paused room makes no next broadcast: the ack settles the resync, as `SnapshotDispatch.acknowledge` does.
    if (!this.options.isRoomPaused || !this.backlog.isResyncDue(this.connection)) return;
    this.backlog.recordResyncSent(PLAYER_ID, tick);
    this.receiveResync(broadcast, tick);
  }

  private acknowledge(tick: number): void {
    this.acknowledgedTick = Math.max(this.acknowledgedTick, tick);
    this.backlog.recordAcknowledgedTick(PLAYER_ID, tick);
  }

  private holdUnacknowledgedBytes(): void {
    const bytes = this.isSocketHolding() ? bytesSentAfter(this.sent, this.acknowledgedTick) : 0;
    setBufferedAmount(this.connection, bytes);
  }

  private isSocketHolding(): boolean {
    return this.options.deltaBytes !== undefined;
  }
}

function resyncGapsOf(options: LaggingClientOptions): ResyncGap[] {
  const client = new WorstLaggingClient(options);
  for (let broadcast = 0; broadcast < BROADCASTS; broadcast += 1) client.broadcast(broadcast);
  return client.gaps;
}

describe('SnapshotBacklog resync rate (#277, docs/architecture/wire-contract.md §4.1)', () => {
  describe.each([
    { room: 'running', isRoomPaused: false },
    { room: 'paused and stepped', isRoomPaused: true },
  ])('in a $room room', ({ isRoomPaused }) => {
    it.each(RESYNC_ACK_DELAYS)(
      'resyncs a client at most once per backlog limit of ticks, its resync acked %i broadcasts late',
      (resyncAckDelay) => {
        const gaps = resyncGapsOf({ isRoomPaused, resyncAckDelay });
        expect(gaps.length).toBeGreaterThanOrEqual(MIN_RESYNCS);
        for (const gap of gaps) expect(gap.ticks).toBeGreaterThan(SNAPSHOT_BACKLOG_LIMIT_TICKS);
      },
    );

    it.each(RESYNC_ACK_DELAYS)(
      'resyncs a client whose socket fills first at most once per byte limit of deltas, its resync acked %i late',
      (resyncAckDelay) => {
        const gaps = resyncGapsOf({ isRoomPaused, resyncAckDelay, deltaBytes: OVER_BUDGET_DELTA_BYTES });
        expect(gaps.length).toBeGreaterThanOrEqual(MIN_RESYNCS);
        // The byte half is the one that binds here: the gap is shorter than the tick limit.
        expect(Math.min(...gaps.map((gap) => gap.ticks))).toBeLessThanOrEqual(SNAPSHOT_BACKLOG_LIMIT_TICKS);
        for (const gap of gaps) expect(gap.deltaBytes).toBeGreaterThan(SNAPSHOT_BACKLOG_LIMIT_BYTES);
      },
    );
  });
});
