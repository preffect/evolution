// Per-connection snapshot flow control (#266, docs/architecture/wire-contract.md §4): the room broadcasts a delta
// every `SNAPSHOT_EVERY_TICKS`, and a client that cannot drain that cadence would otherwise be
// queued every snapshot the room ever sent it — its view falls behind for good and never catches
// up, because nothing in the stream lets it skip ahead. This decides, per connection and per
// broadcast, whether it gets the delta, one `game_state` instead (the resync a skipped delta stream
// needs: `food` is the only relative part of a snapshot, and `game_state` is the verb that replaces
// it) or nothing at all.
//
// Two signals, either of which skips a connection:
//   - **the queue between us and it**, in ticks: the newest tick the room sent it minus the newest
//     the client says it applied (`snapshot_ack`). This is the one that works wherever the queue
//     actually sits — the room's socket, a dev proxy, the kernel, the browser's own event loop.
//   - **the queue we are holding ourselves**, in bytes: `socket.bufferedAmount`, which catches a
//     socket that has stopped writing at all, with no client help.
// A client that never acknowledges is never skipped by the first signal (the headless bot client
// and any other non-browser client): silence is not evidence of a backlog.
//
// Game-agnostic: it reads a tick, a player id and `bufferedAmount`, and nothing else.

import { SNAPSHOT_BACKLOG_LIMIT_BYTES, SNAPSHOT_BACKLOG_LIMIT_TICKS } from '@evolution/shared';
import type { Connection } from '../ws/connection.js';

/** What one connection is sent on one broadcast. */
export const SNAPSHOT_DELIVERY = {
  /** The delta since the previous broadcast: the healthy path. */
  delta: 'delta',
  /** A full `game_state`: the connection fell behind, skipped deltas, and must be rebuilt. */
  resync: 'resync',
  /** Nothing: the connection has not caught up with what it was already sent. */
  skipped: 'skipped',
} as const;

export type SnapshotDelivery = (typeof SNAPSHOT_DELIVERY)[keyof typeof SNAPSHOT_DELIVERY];

export interface SnapshotBacklogLimits {
  /** Ticks of snapshots that may be in flight to one client. */
  readonly ticks?: number;
  /** Unsent bytes the room may hold for one connection. */
  readonly bytes?: number;
}

/**
 * One room's flow control: what each connection was last sent, what it last acknowledged, and who
 * is owed a `game_state`. The room asks it once per connection per broadcast.
 */
export class SnapshotBacklog {
  private readonly owedResync = new Set<string>();
  private readonly lastSentTick = new Map<string, number>();
  private readonly acknowledgedTick = new Map<string, number>();
  /** The tick of the `game_state` each client was resynced with, until it acknowledges that tick (#275). */
  private readonly resyncInFlightTick = new Map<string, number>();
  private readonly limitTicks: number;
  private readonly limitBytes: number;
  private resyncTotal = 0;

  constructor(limits: SnapshotBacklogLimits = {}) {
    this.limitTicks = limits.ticks ?? SNAPSHOT_BACKLOG_LIMIT_TICKS;
    this.limitBytes = limits.bytes ?? SNAPSHOT_BACKLOG_LIMIT_BYTES;
  }

  /** The newest tick a client says it has applied; an older or repeated ack changes nothing. */
  recordAcknowledgedTick(playerId: string, tick: number): void {
    const known = this.acknowledgedTick.get(playerId);
    if (known !== undefined && known >= tick) return;
    this.acknowledgedTick.set(playerId, tick);
  }

  /**
   * What this connection gets on this broadcast. A connection that has not caught up is skipped and
   * remembered; a remembered one that has caught up is resynced once and forgotten.
   */
  nextFor(connection: Connection, broadcastTick: number, isRoomPaused = false): SnapshotDelivery {
    const { playerId } = connection;
    if (this.isAwaitingResyncAck(playerId)) return this.deliveryWhileHeld(playerId, broadcastTick, isRoomPaused);
    if (this.isBehind(playerId) || this.isHoldingBytes(connection)) {
      this.owedResync.add(playerId);
      return SNAPSHOT_DELIVERY.skipped;
    }
    this.lastSentTick.set(playerId, broadcastTick);
    if (!this.owedResync.delete(playerId)) {
      return SNAPSHOT_DELIVERY.delta;
    }
    this.markResyncSent(playerId, broadcastTick);
    return SNAPSHOT_DELIVERY.resync;
  }

  /**
   * A broadcast while the client's resync is still unacknowledged (#275). A running room skips it and owes nothing: the
   * resync is queued behind older deltas, anything more only deepens that queue, and the acks it waits behind would
   * read as "behind" and arm a second full state; the next broadcast after the ack covers the gap. A paused room makes
   * no next broadcast, so a `debug_step_room` taken during the hold is sent as its delta, queued after the resync:
   * steps of any size still leave the client current (#300), and nothing is re-armed.
   */
  private deliveryWhileHeld(playerId: string, broadcastTick: number, isRoomPaused: boolean): SnapshotDelivery {
    if (!isRoomPaused) return SNAPSHOT_DELIVERY.skipped;
    this.lastSentTick.set(playerId, broadcastTick);
    return SNAPSHOT_DELIVERY.delta;
  }

  /**
   * Owed a `game_state` and caught up: what a room that makes no broadcast to settle it on checks on each ack — a
   * paused room after a `debug_step_room` burst deeper than the limit (#300).
   */
  isResyncDue(connection: Connection): boolean {
    const { playerId } = connection;
    return this.owedResync.has(playerId) && !this.isBehind(playerId) && !this.isHoldingBytes(connection);
  }

  /** The `game_state` a due resync was settled with has been sent at `tick`, as the broadcast would record it. */
  recordResyncSent(playerId: string, tick: number): void {
    this.owedResync.delete(playerId);
    this.lastSentTick.set(playerId, tick);
    this.markResyncSent(playerId, tick);
  }

  /** Counted, and remembered until acknowledged. */
  private markResyncSent(playerId: string, tick: number): void {
    this.resyncTotal += 1;
    this.resyncInFlightTick.set(playerId, tick);
  }

  /** A resync is in flight and the client has not acknowledged its tick yet; one that never acks is never held. */
  private isAwaitingResyncAck(playerId: string): boolean {
    const resyncTick = this.resyncInFlightTick.get(playerId);
    if (resyncTick === undefined) return false;
    if ((this.acknowledgedTick.get(playerId) ?? resyncTick) < resyncTick) return true;
    this.resyncInFlightTick.delete(playerId);
    return false;
  }

  /**
   * A player who left, or who was just sent a `game_state` by another path (join, reconnect): the
   * room and that client agree again, and nothing about the old stream is worth remembering.
   */
  forget(playerId: string): void {
    this.owedResync.delete(playerId);
    this.lastSentTick.delete(playerId);
    this.acknowledgedTick.delete(playerId);
    this.resyncInFlightTick.delete(playerId);
  }

  /** Players currently owed a `game_state`. Telemetry: it never decides anything. */
  owedCount(): number {
    return this.owedResync.size;
  }

  /** Resyncs this room has sent: how often a client fell behind the cadence (docs/architecture/wire-contract.md §4). */
  resyncCount(): number {
    return this.resyncTotal;
  }

  /**
   * Ticks of snapshots in flight to a client, or `null` before it has been sent one or has
   * acknowledged one. What the debug tools read to see a client falling behind.
   */
  backlogTicksOf(playerId: string): number | null {
    const sent = this.lastSentTick.get(playerId);
    const acknowledged = this.acknowledgedTick.get(playerId);
    if (sent === undefined || acknowledged === undefined) return null;
    return sent - acknowledged;
  }

  /** A module whose snapshots carry no tick (the template echo) leaves this `null`, so it never skips. */
  private isBehind(playerId: string): boolean {
    const backlogTicks = this.backlogTicksOf(playerId);
    return backlogTicks !== null && backlogTicks > this.limitTicks;
  }

  private isHoldingBytes(connection: Connection): boolean {
    return connection.socket.bufferedAmount > this.limitBytes;
  }
}
