import { describe, expect, it } from 'vitest';
import {
  SNAPSHOT_ACK_EVERY_SNAPSHOTS,
  SNAPSHOT_BACKLOG_LIMIT_BYTES,
  SNAPSHOT_BACKLOG_LIMIT_TICKS,
} from '@evolution/shared';
import { SNAPSHOT_DELIVERY, SnapshotBacklog } from './snapshot-backlog.js';
import { createTestConnection, setBufferedAmount } from '../testing/builders.js';

const DRAINED = 0;
const SATURATED_BYTES = SNAPSHOT_BACKLOG_LIMIT_BYTES + 1;
const FIRST_TICK = 1;

/** A backlog and one connection on it, with the ticks a healthy client would acknowledge. */
function oneConnection(playerId = 'p1') {
  const backlog = new SnapshotBacklog();
  const connection = createTestConnection({ playerId, bufferedAmount: DRAINED });
  /** Sends `count` broadcasts from `from`, acknowledging each one as a client that keeps up would. */
  const streamAcknowledged = (from: number, count: number): void => {
    for (let tick = from; tick < from + count; tick += 1) {
      backlog.nextFor(connection, tick);
      backlog.recordAcknowledgedTick(playerId, tick);
    }
  };
  /**
   * Sends one ack cadence of deltas from `from`, one tick apart, none acknowledged: however deep the queue reads, a
   * client owes no ack before it holds that many (#655). Returns the newest tick sent.
   */
  const sendOneAckCadence = (from: number): number => {
    const last = from + SNAPSHOT_ACK_EVERY_SNAPSHOTS - 1;
    for (let tick = from; tick <= last; tick += 1) {
      expect(backlog.nextFor(connection, tick)).toBe(SNAPSHOT_DELIVERY.delta);
    }
    return last;
  };
  return { backlog, connection, playerId, streamAcknowledged, sendOneAckCadence };
}

describe('SnapshotBacklog', () => {
  it('sends the delta to a client that keeps up with what it is sent', () => {
    const { backlog, connection, streamAcknowledged } = oneConnection();
    streamAcknowledged(FIRST_TICK, SNAPSHOT_BACKLOG_LIMIT_TICKS);
    expect(backlog.nextFor(connection, SNAPSHOT_BACKLOG_LIMIT_TICKS + 1)).toBe(SNAPSHOT_DELIVERY.delta);
    expect(backlog.owedCount()).toBe(0);
    expect(backlog.resyncCount()).toBe(0);
  });

  it('sends the delta to a client that has never acknowledged: silence is not a backlog', () => {
    const { backlog, connection } = oneConnection();
    for (let tick = FIRST_TICK; tick < SNAPSHOT_BACKLOG_LIMIT_TICKS * 3; tick += 1) {
      expect(backlog.nextFor(connection, tick)).toBe(SNAPSHOT_DELIVERY.delta);
    }
    expect(backlog.backlogTicksOf('p1')).toBeNull();
  });

  it('sends nothing once more than the limit of ticks is in flight and an ack is owed, however long that lasts', () => {
    const { backlog, connection, playerId, sendOneAckCadence } = oneConnection();
    backlog.nextFor(connection, FIRST_TICK);
    backlog.recordAcknowledgedTick(playerId, FIRST_TICK);
    // The client acknowledged nothing since, so once it holds a cadence of deltas the next broadcast is past the limit.
    const lastSent = sendOneAckCadence(FIRST_TICK + SNAPSHOT_BACKLOG_LIMIT_TICKS + 1);
    expect(backlog.nextFor(connection, lastSent + 1)).toBe(SNAPSHOT_DELIVERY.skipped);
    expect(backlog.nextFor(connection, lastSent + 2)).toBe(SNAPSHOT_DELIVERY.skipped);
    expect(backlog.owedCount()).toBe(1);
    expect(backlog.backlogTicksOf(playerId)).toBe(lastSent - FIRST_TICK);
  });

  it('#655: keeps sending past the limit to a client that owes no ack yet, since it may never send one', () => {
    const { backlog, connection, playerId } = oneConnection();
    backlog.nextFor(connection, FIRST_TICK);
    backlog.recordAcknowledgedTick(playerId, FIRST_TICK);
    // One delta that spans more than the limit on its own: the browser acks only every SNAPSHOT_ACK_EVERY_SNAPSHOTS.
    const spanningTick = FIRST_TICK + SNAPSHOT_BACKLOG_LIMIT_TICKS * 2;
    backlog.nextFor(connection, spanningTick);
    expect(backlog.backlogTicksOf(playerId)).toBeGreaterThan(SNAPSHOT_BACKLOG_LIMIT_TICKS);
    expect(backlog.nextFor(connection, spanningTick + 1)).toBe(SNAPSHOT_DELIVERY.delta);
    expect(backlog.owedCount()).toBe(0);
  });

  it('sends exactly one game_state when the skipped client catches up, then deltas again', () => {
    const { backlog, connection, playerId, sendOneAckCadence } = oneConnection();
    backlog.nextFor(connection, FIRST_TICK);
    backlog.recordAcknowledgedTick(playerId, FIRST_TICK);
    const behindTick = sendOneAckCadence(FIRST_TICK + SNAPSHOT_BACKLOG_LIMIT_TICKS + 2);
    expect(backlog.nextFor(connection, behindTick + 1)).toBe(SNAPSHOT_DELIVERY.skipped);

    backlog.recordAcknowledgedTick(playerId, behindTick);
    expect(backlog.nextFor(connection, behindTick + 2)).toBe(SNAPSHOT_DELIVERY.resync);
    backlog.recordAcknowledgedTick(playerId, behindTick + 2);
    expect(backlog.nextFor(connection, behindTick + 3)).toBe(SNAPSHOT_DELIVERY.delta);
    expect(backlog.owedCount()).toBe(0);
    expect(backlog.resyncCount()).toBe(1);
  });

  it('ignores an acknowledgement older than one it already has', () => {
    const { backlog, connection, playerId } = oneConnection();
    backlog.nextFor(connection, FIRST_TICK + 1);
    backlog.recordAcknowledgedTick(playerId, FIRST_TICK + 1);
    backlog.recordAcknowledgedTick(playerId, FIRST_TICK);
    expect(backlog.backlogTicksOf(playerId)).toBe(0);
  });

  it('sends nothing to a connection holding more than the limit of unsent bytes, with no ack at all', () => {
    const { backlog, connection } = oneConnection();
    setBufferedAmount(connection, SATURATED_BYTES);
    expect(backlog.nextFor(connection, FIRST_TICK)).toBe(SNAPSHOT_DELIVERY.skipped);
    setBufferedAmount(connection, DRAINED);
    expect(backlog.nextFor(connection, FIRST_TICK + 1)).toBe(SNAPSHOT_DELIVERY.resync);
  });

  it('decides per connection: one client falling behind does not cost the others their deltas', () => {
    const backlog = new SnapshotBacklog();
    const slow = createTestConnection({ playerId: 'slow', bufferedAmount: SATURATED_BYTES });
    const fast = createTestConnection({ playerId: 'fast', bufferedAmount: DRAINED });
    expect(backlog.nextFor(slow, FIRST_TICK)).toBe(SNAPSHOT_DELIVERY.skipped);
    expect(backlog.nextFor(fast, FIRST_TICK)).toBe(SNAPSHOT_DELIVERY.delta);
  });

  it('forgets a player who was sent a game_state by another path, so no second one follows', () => {
    const { backlog, connection, playerId } = oneConnection();
    setBufferedAmount(connection, SATURATED_BYTES);
    backlog.nextFor(connection, FIRST_TICK);
    backlog.forget(playerId);
    setBufferedAmount(connection, DRAINED);
    expect(backlog.nextFor(connection, FIRST_TICK + 1)).toBe(SNAPSHOT_DELIVERY.delta);
    expect(backlog.backlogTicksOf(playerId)).toBeNull();
    expect(backlog.resyncCount()).toBe(0);
  });

  it('#300: a resync is due only once owed and caught up, and recording it settles it like a broadcast would', () => {
    const { backlog, connection, playerId, sendOneAckCadence } = oneConnection();
    expect(backlog.isResyncDue(connection)).toBe(false);
    backlog.nextFor(connection, FIRST_TICK);
    backlog.recordAcknowledgedTick(playerId, FIRST_TICK);
    const behindTick = sendOneAckCadence(FIRST_TICK + SNAPSHOT_BACKLOG_LIMIT_TICKS + 1);
    backlog.nextFor(connection, behindTick + 1);
    expect(backlog.isResyncDue(connection)).toBe(false);
    backlog.recordAcknowledgedTick(playerId, behindTick);
    expect(backlog.isResyncDue(connection)).toBe(true);
    setBufferedAmount(connection, SATURATED_BYTES);
    expect(backlog.isResyncDue(connection)).toBe(false);
    setBufferedAmount(connection, DRAINED);
    backlog.recordResyncSent(playerId, behindTick + 2);
    expect([backlog.isResyncDue(connection), backlog.owedCount(), backlog.resyncCount()]).toEqual([false, 0, 1]);
    expect(backlog.backlogTicksOf(playerId)).toBe(2);
    // Held until the client acknowledges the resync's own tick (#275), then deltas again.
    expect(backlog.nextFor(connection, behindTick + 3)).toBe(SNAPSHOT_DELIVERY.skipped);
    backlog.recordAcknowledgedTick(playerId, behindTick + 2);
    expect(backlog.nextFor(connection, behindTick + 4)).toBe(SNAPSHOT_DELIVERY.delta);
  });

  it('#275: after a resync, sends nothing and owes nothing until the client acknowledges that tick', () => {
    const { backlog, connection, playerId, sendOneAckCadence } = oneConnection();
    backlog.nextFor(connection, FIRST_TICK);
    backlog.recordAcknowledgedTick(playerId, FIRST_TICK);
    const behindTick = sendOneAckCadence(FIRST_TICK + SNAPSHOT_BACKLOG_LIMIT_TICKS + 1);
    expect(backlog.nextFor(connection, behindTick + 1)).toBe(SNAPSHOT_DELIVERY.skipped);
    backlog.recordAcknowledgedTick(playerId, behindTick);
    const resyncTick = behindTick + 2;
    expect(backlog.nextFor(connection, resyncTick)).toBe(SNAPSHOT_DELIVERY.resync);
    // The client still acks the deltas queued ahead of the resync: far behind, but no second resync is armed.
    for (let tick = resyncTick + 1; tick < resyncTick + SNAPSHOT_BACKLOG_LIMIT_TICKS * 3; tick += 1) {
      expect(backlog.nextFor(connection, tick)).toBe(SNAPSHOT_DELIVERY.skipped);
    }
    expect([backlog.owedCount(), backlog.resyncCount()]).toEqual([0, 1]);
    backlog.recordAcknowledgedTick(playerId, resyncTick);
    expect(backlog.nextFor(connection, resyncTick + SNAPSHOT_BACKLOG_LIMIT_TICKS * 3)).toBe(SNAPSHOT_DELIVERY.delta);
  });

  it('#655: the stream a resync hold ends restarts its depth there, not at the resync the hold ran past', () => {
    const { backlog, connection, playerId, sendOneAckCadence } = oneConnection();
    backlog.nextFor(connection, FIRST_TICK);
    backlog.recordAcknowledgedTick(playerId, FIRST_TICK);
    const behindTick = sendOneAckCadence(FIRST_TICK + SNAPSHOT_BACKLOG_LIMIT_TICKS + 1);
    backlog.nextFor(connection, behindTick + 1);
    backlog.recordAcknowledgedTick(playerId, behindTick);
    const resyncTick = behindTick + 2;
    expect(backlog.nextFor(connection, resyncTick)).toBe(SNAPSHOT_DELIVERY.resync);
    // A slow page applies the resync only after the running room has held it past the limit twice over.
    const restartTick = resyncTick + SNAPSHOT_BACKLOG_LIMIT_TICKS * 2;
    for (let tick = resyncTick + 1; tick < restartTick; tick += 1) backlog.nextFor(connection, tick);
    backlog.recordAcknowledgedTick(playerId, resyncTick);
    expect(backlog.nextFor(connection, restartTick)).toBe(SNAPSHOT_DELIVERY.delta);
    expect(backlog.backlogTicksOf(playerId)).toBe(0);
    // Its acks have not arrived yet: the room keeps sending, since the held ticks were never in any queue.
    sendOneAckCadence(restartTick + 1);
    sendOneAckCadence(restartTick + 1 + SNAPSHOT_ACK_EVERY_SNAPSHOTS);
    expect([backlog.owedCount(), backlog.resyncCount()]).toEqual([0, 1]);
  });

  it('#275: a client that has never acknowledged is not held after a resync (silence is not a backlog)', () => {
    const { backlog, connection } = oneConnection();
    setBufferedAmount(connection, SATURATED_BYTES);
    expect(backlog.nextFor(connection, FIRST_TICK)).toBe(SNAPSHOT_DELIVERY.skipped);
    setBufferedAmount(connection, DRAINED);
    expect(backlog.nextFor(connection, FIRST_TICK + 1)).toBe(SNAPSHOT_DELIVERY.resync);
    expect(backlog.nextFor(connection, FIRST_TICK + 2)).toBe(SNAPSHOT_DELIVERY.delta);
  });
});
