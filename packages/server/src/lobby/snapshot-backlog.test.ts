import { describe, expect, it } from 'vitest';
import { SNAPSHOT_BACKLOG_LIMIT_BYTES, SNAPSHOT_BACKLOG_LIMIT_TICKS } from '@evolution/shared';
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
  return { backlog, connection, playerId, streamAcknowledged };
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

  it('sends nothing once more than the limit of ticks is in flight, however long that lasts', () => {
    const { backlog, connection, playerId } = oneConnection();
    backlog.nextFor(connection, FIRST_TICK);
    backlog.recordAcknowledgedTick(playerId, FIRST_TICK);
    const behindTick = FIRST_TICK + SNAPSHOT_BACKLOG_LIMIT_TICKS + 1;
    expect(backlog.nextFor(connection, behindTick)).toBe(SNAPSHOT_DELIVERY.delta);
    // The client acknowledged nothing since, so the next broadcast is past the limit.
    expect(backlog.nextFor(connection, behindTick + 1)).toBe(SNAPSHOT_DELIVERY.skipped);
    expect(backlog.nextFor(connection, behindTick + 2)).toBe(SNAPSHOT_DELIVERY.skipped);
    expect(backlog.owedCount()).toBe(1);
    expect(backlog.backlogTicksOf(playerId)).toBe(SNAPSHOT_BACKLOG_LIMIT_TICKS + 1);
  });

  it('sends exactly one game_state when the skipped client catches up, then deltas again', () => {
    const { backlog, connection, playerId } = oneConnection();
    backlog.nextFor(connection, FIRST_TICK);
    backlog.recordAcknowledgedTick(playerId, FIRST_TICK);
    const behindTick = FIRST_TICK + SNAPSHOT_BACKLOG_LIMIT_TICKS + 2;
    backlog.nextFor(connection, behindTick);
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
});
