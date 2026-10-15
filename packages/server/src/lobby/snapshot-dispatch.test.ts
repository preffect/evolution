// Unit (docs/testing/tiers-and-builders.md §2): `SnapshotDispatch`, what a room sends when it broadcasts and how every
// byte of it reaches the tracker (docs/architecture/wire-contract.md §4, #276, #714). Who is sent what is
// `snapshot-backlog.test.ts`; the room's side of the cadence is `game-room-cadence.test.ts`.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
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
  const game = createTickingGameModule();
  const dispatch = new SnapshotDispatch(game, room);
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
  /** Makes the next broadcasts hold a change no delta carries, or not (the Evolution pool's move). */
  const setViewRestart = (isRestart: boolean) => {
    game.isViewRestartBroadcast = () => isRestart;
  };
  return { dispatch, room, game, sent, connections, bytesSent, recordSilentTick, setPaused, setViewRestart };
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

describe('SnapshotDispatch: the broadcast that holds a view restart (wire-contract.md §4 "The move")', () => {
  const typesSentTo = (sent: SentLog, playerId: string) =>
    (sent[playerId] as { type: string }[]).map((message) => message.type);

  it('sends it to every connection as a game_state carrying the broadcast, counted as a resync', () => {
    const { dispatch, room, sent, recordSilentTick, setViewRestart } = dispatchFixture();
    setViewRestart(true);
    expect(dispatch.broadcastOnTick()).toEqual({ snapshotBytes: 0, broadcastClients: 0 });
    for (const playerId of PLAYER_IDS) {
      expect(sent[playerId]).toMatchObject([{ type: SERVER_MESSAGE_TYPE.gameState, playerId, snapshot: { tick: 1 } }]);
    }
    expect(room.snapshotBacklog.resyncCount()).toBe(PLAYER_IDS.length);
    recordSilentTick();
    const bytes = PLAYER_IDS.reduce((sum, playerId) => sum + JSON.stringify(sent[playerId]![0]).length, 0);
    expect(room.performanceTracker.worstTick()?.resyncBytes).toBe(bytes);
  });

  it('sends nothing to a connection its in-flight resync holds and owes it one; an ordinary broadcast owes none', () => {
    for (const isRestart of [true, false]) {
      const { dispatch, room, sent, setViewRestart } = dispatchFixture();
      room.snapshotBacklog.recordAcknowledgedTick('p1', 0);
      room.snapshotBacklog.recordResyncSent('p1', 1);
      setViewRestart(isRestart);
      dispatch.broadcastOnTick();
      expect(sent['p1']).toEqual([]);
      setViewRestart(false);
      dispatch.acknowledge('p1', 1);
      dispatch.broadcastOnTick();
      const expected = isRestart ? SERVER_MESSAGE_TYPE.gameState : SERVER_MESSAGE_TYPE.gameSnapshot;
      expect(typesSentTo(sent, 'p1')).toEqual([expected]);
    }
  });

  it('sends a paused room’s held connection nothing after the move until its owed resync', () => {
    const { dispatch, room, sent, setViewRestart, setPaused } = dispatchFixture();
    room.snapshotBacklog.recordAcknowledgedTick('p1', 0);
    room.snapshotBacklog.recordResyncSent('p1', 1);
    setViewRestart(true);
    dispatch.broadcastOnTick();
    setViewRestart(false);
    setPaused(true);
    dispatch.broadcastOffTick();
    expect(sent['p1']).toEqual([]);
    dispatch.acknowledge('p1', 1);
    expect(typesSentTo(sent, 'p1')).toEqual([SERVER_MESSAGE_TYPE.gameState]);
  });

  it('sends a connection owed a resync that caught up at the move one game_state, counted once', () => {
    const { dispatch, room, sent, connections, setViewRestart } = dispatchFixture();
    setBufferedAmount(connections[0]!, SATURATED_BYTES);
    dispatch.broadcastOnTick();
    setBufferedAmount(connections[0]!, 0);
    expect(room.snapshotBacklog.owedCount()).toBe(1);
    const resyncsBefore = room.snapshotBacklog.resyncCount();
    setViewRestart(true);
    dispatch.broadcastOnTick();
    expect(typesSentTo(sent, 'p1')).toEqual([SERVER_MESSAGE_TYPE.gameState]);
    expect(room.snapshotBacklog.resyncCount()).toBe(resyncsBefore + PLAYER_IDS.length);
    expect(room.snapshotBacklog.owedCount()).toBe(0);
  });

  it('carries the module’s live balance, read without serialising the world', () => {
    const { dispatch, game, sent, setViewRestart } = dispatchFixture();
    const liveBalance = structuredClone(DEFAULT_BALANCE);
    game.liveBalance = () => liveBalance;
    setViewRestart(true);
    dispatch.broadcastOnTick();
    expect(sent['p1']).toMatchObject([{ type: SERVER_MESSAGE_TYPE.gameState, balance: liveBalance }]);
    expect(game.serializeFullState).not.toHaveBeenCalled();
  });
});
