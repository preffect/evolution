// Unit (docs/testing/tiers-and-builders.md §2): `SnapshotDispatch`, what a room sends when it broadcasts and how every
// byte of it reaches the tracker (docs/architecture/wire-contract.md §4, #276, #714). Who is sent what is
// `snapshot-backlog.test.ts`; the room's side of the cadence is `game-room-cadence.test.ts`.
import { describe, expect, it } from 'vitest';
import {
  SERVER_MESSAGE_TYPE,
  SNAPSHOT_BACKLOG_LIMIT_BYTES,
  TICK_HZ,
  createTestSessionConfig,
  gameId,
} from '@evolution/shared';
import type { PlayerId } from '@evolution/shared';
import { PerformanceTracker, roundToHundredths } from './performance-tracker.js';
import { SnapshotBacklog } from './snapshot-backlog.js';
import { SnapshotDispatch, type SnapshotDispatchRoom } from './snapshot-dispatch.js';
import { createTestConnection, createTickingGameModule, setBufferedAmount, type SentLog } from '../testing/builders.js';

const PLAYER_IDS = ['p1', 'p2'] as const;
const SATURATED_BYTES = SNAPSHOT_BACKLOG_LIMIT_BYTES + 1;

/** A dispatch over a two-player room whose pause the test sets by hand. */
function dispatchFixture() {
  const sent: SentLog = {};
  const connections = PLAYER_IDS.map((playerId) => createTestConnection({ playerId, sent }));
  let isPaused = false;
  const room: SnapshotDispatchRoom = {
    gameId: gameId('g1'),
    sessionConfig: createTestSessionConfig(),
    allPlayerIds: [...PLAYER_IDS],
    avatarAssignments: Object.fromEntries(PLAYER_IDS.map((playerId, index) => [playerId, index])),
    playerConnections: new Map(connections.map((connection) => [connection.playerId, connection])),
    snapshotBacklog: new SnapshotBacklog(),
    performanceTracker: new PerformanceTracker(),
    isPaused: () => isPaused,
  };
  const dispatch = new SnapshotDispatch(createTickingGameModule(), room);
  const bytesSent = () =>
    Object.values(sent)
      .flat()
      .reduce<number>((sum, message) => sum + JSON.stringify(message).length, 0);
  /** One silent tick record, as the room's loop makes between broadcasts. */
  const recordSilentTick = () =>
    room.performanceTracker.recordTick({
      tickMs: 0,
      broadcastMs: 0,
      isBroadcastTick: false,
      snapshotBytes: 0,
      broadcastClients: 0,
    });
  const setPaused = (isNowPaused: boolean) => {
    isPaused = isNowPaused;
  };
  return { dispatch, room, sent, connections, bytesSent, recordSilentTick, setPaused };
}

describe('SnapshotDispatch', () => {
  it('returns the loop broadcast for the tick record and reports none of it itself', () => {
    const { dispatch, room, bytesSent, recordSilentTick } = dispatchFixture();
    const broadcast = dispatch.broadcastOnTick();
    expect(broadcast).toEqual({ snapshotBytes: bytesSent() / PLAYER_IDS.length, broadcastClients: PLAYER_IDS.length });
    recordSilentTick();
    expect(room.performanceTracker.getStats().broadcastBytesPerSec).toBe(0);
  });

  it('#714: counts an off-tick broadcast, every client of it, on the next tick record', () => {
    const { dispatch, room, sent, bytesSent, recordSilentTick } = dispatchFixture();
    dispatch.broadcastOffTick();
    recordSilentTick();
    expect(PLAYER_IDS.map((playerId) => sent[playerId]!.length)).toEqual([1, 1]);
    expect(room.performanceTracker.worstTick()?.offTickBytes).toBe(bytesSent());
    expect(room.performanceTracker.getStats().broadcastBytesPerSec).toBe(roundToHundredths(bytesSent() * TICK_HZ));
  });

  it('sends a paused room player its due resync on the ack, and counts it', () => {
    const { dispatch, room, sent, connections, recordSilentTick, setPaused } = dispatchFixture();
    const [lagging] = connections;
    setBufferedAmount(lagging!, SATURATED_BYTES);
    dispatch.broadcastOnTick();
    setBufferedAmount(lagging!, 0);
    setPaused(true);
    dispatch.acknowledge('p1', 0);
    expect((sent['p1'] as { type: string }[]).map((message) => message.type)).toEqual([SERVER_MESSAGE_TYPE.gameState]);
    expect(room.snapshotBacklog.owedCount()).toBe(0);
    const resyncBytes = JSON.stringify(sent['p1']![0]).length;
    recordSilentTick();
    expect(room.performanceTracker.worstTick()?.resyncBytes).toBe(resyncBytes);
  });

  it('leaves a running room due resync to its next broadcast', () => {
    const { dispatch, room, sent, connections } = dispatchFixture();
    const [lagging] = connections;
    setBufferedAmount(lagging!, SATURATED_BYTES);
    dispatch.broadcastOnTick();
    setBufferedAmount(lagging!, 0);
    dispatch.acknowledge('p1', 0);
    expect(sent['p1']).toEqual([]);
    expect(room.snapshotBacklog.owedCount()).toBe(1);
  });

  it('builds the game_state from the room roster as it is now, for that viewer', () => {
    const { dispatch, room } = dispatchFixture();
    (room.allPlayerIds as string[]).push('p3');
    expect(dispatch.gameStateMessageFor('p2' as PlayerId)).toMatchObject({
      type: SERVER_MESSAGE_TYPE.gameState,
      gameId: gameId('g1'),
      playerId: 'p2',
      playerIds: [...PLAYER_IDS, 'p3'],
      config: room.sessionConfig,
    });
  });
});
