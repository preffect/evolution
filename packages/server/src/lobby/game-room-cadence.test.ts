// The broadcast cadence (docs/architecture/entity-model.md §1, docs/architecture/wire-contract.md §4.1, #214): the room steps at `TICK_HZ` and
// serialises every `SNAPSHOT_EVERY_TICKS` ticks. Its own file because `game-room.test.ts` owns the
// loop, membership and the debug controls and is already at the size limit.

import { describe, it, expect, vi } from 'vitest';
import {
  SERVER_MESSAGE_TYPE,
  SNAPSHOT_ACK_EVERY_SNAPSHOTS,
  SNAPSHOT_ACK_EVERY_TICKS,
  SNAPSHOT_BACKLOG_LIMIT_TICKS,
  SNAPSHOT_EVERY_TICKS,
  TICK_HZ,
  TICK_INTERVAL_MS,
  type GameSnapshot,
} from '@evolution/shared';
import { GameRoom } from './game-room.js';
import { roundToHundredths } from './performance-tracker.js';
import {
  createManualRoomTiming,
  createSpyGameModule,
  createTestConnection,
  createTestRoomInitOptions,
  type SentLog,
} from '../testing/builders.js';

const ROOM_PLAYER_ID = 'p1';
/** How many times over the backlog limit a flow-control test runs the room. */
const RUNS_OF_THE_LIMIT = 3;
/** Broadcast intervals a cadence test runs, in the units the test reasons in. */
const INTERVALS_TO_COUNT_BROADCASTS = 4;
const INTERVALS_TO_SPAN_SKIPPED_TICKS = 3;
const INTERVALS_TO_SAMPLE_BYTES = 2;
/** Ticks past a boundary `step()` is asked for: deliberately not a whole interval. */
const TICKS_PAST_A_BOUNDARY = 1;
/** Frames sent off the tick record in the off-tick test: a step's closing frame and a republish. */
const OFF_TICK_FRAMES = 2;
const roomOptions = () => createTestRoomInitOptions([ROOM_PLAYER_ID]);

/**
 * A module that records one moment per tick and hands over everything since the last serialisation:
 * the drain `serializeRoomState` really is (the food delta tracker and the effects), so a test can
 * see whether a tick the room skipped broadcasting was carried by the next snapshot or lost.
 */
function createDrainingGameModule() {
  let pending: number[] = [];
  let tick = 0;
  const gameModule = createSpyGameModule();
  vi.mocked(gameModule.reduceGameState).mockImplementation(() => {
    tick += 1;
    pending.push(tick);
  });
  vi.mocked(gameModule.serializeRoomState).mockImplementation(() => {
    const drained = pending;
    pending = [];
    return { tick, moments: drained } as unknown as GameSnapshot;
  });
  return gameModule;
}

/** The ticks of every `game_snapshot` in a send log, in arrival order. */
function broadcastTicks(sent: SentLog, playerId: string): number[] {
  return (sent[playerId] ?? [])
    .filter((message) => (message as { type: string }).type === SERVER_MESSAGE_TYPE.gameSnapshot)
    .map((message) => (message as { snapshot: { tick: number } }).snapshot.tick);
}

/** The `moments` every `game_snapshot` in a send log carried, concatenated in arrival order. */
function broadcastMoments(sent: SentLog, playerId: string): number[] {
  return (sent[playerId] ?? [])
    .filter((message) => (message as { type: string }).type === SERVER_MESSAGE_TYPE.gameSnapshot)
    .flatMap((message) => (message as { snapshot: { moments: number[] } }).snapshot.moments);
}

describe('game-room: the broadcast cadence (docs/architecture/entity-model.md §1, #214)', () => {
  it('steps every tick but serialises and broadcasts once per SNAPSHOT_EVERY_TICKS ticks', () => {
    const sent: SentLog = {};
    const gameModule = createSpyGameModule();
    const timing = createManualRoomTiming();
    const room = new GameRoom(gameModule, roomOptions(), timing);
    room.addPlayer(createTestConnection({ playerId: ROOM_PLAYER_ID, sent }));
    room.start();
    const ticks = INTERVALS_TO_COUNT_BROADCASTS * SNAPSHOT_EVERY_TICKS;
    for (let fire = 0; fire < ticks; fire += 1) {
      timing.clock.advanceMilliseconds(TICK_INTERVAL_MS);
      timing.ticker.fire();
    }
    expect(vi.mocked(gameModule.reduceGameState).mock.calls.length).toBe(ticks);
    expect(gameModule.serializeRoomState).toHaveBeenCalledTimes(ticks / SNAPSHOT_EVERY_TICKS);
    expect(sent[ROOM_PLAYER_ID]).toHaveLength(ticks / SNAPSHOT_EVERY_TICKS);
  });

  it('carries every skipped tick in the next broadcast: a drained delta loses nothing', () => {
    const sent: SentLog = {};
    const timing = createManualRoomTiming();
    const room = new GameRoom(createDrainingGameModule(), roomOptions(), timing);
    room.addPlayer(createTestConnection({ playerId: ROOM_PLAYER_ID, sent }));
    room.start();
    const ticks = INTERVALS_TO_SPAN_SKIPPED_TICKS * SNAPSHOT_EVERY_TICKS;
    for (let fire = 0; fire < ticks; fire += 1) {
      timing.clock.advanceMilliseconds(TICK_INTERVAL_MS);
      timing.ticker.fire();
    }
    const moments = broadcastMoments(sent, ROOM_PLAYER_ID);
    expect(moments).toEqual(Array.from({ length: ticks }, (_unused, index) => index + 1));
  });

  it('records a tick sample on every tick and snapshot bytes only on broadcast ticks', () => {
    const sent: SentLog = {};
    const timing = createManualRoomTiming();
    const room = new GameRoom(createSpyGameModule(), roomOptions(), timing);
    room.addPlayer(createTestConnection({ playerId: ROOM_PLAYER_ID, sent }));
    room.start();
    const ticks = INTERVALS_TO_SAMPLE_BYTES * SNAPSHOT_EVERY_TICKS;
    for (let fire = 0; fire < ticks; fire += 1) {
      timing.clock.advanceMilliseconds(TICK_INTERVAL_MS);
      timing.ticker.fire();
    }
    const stats = room.performanceTracker.getStats();
    expect(stats.sampleCount).toBe(ticks);
    expect(sent[ROOM_PLAYER_ID]).toHaveLength(ticks / SNAPSHOT_EVERY_TICKS);
    // Bytes/sec stays a true rate: the zero-byte ticks are in the average that `TICK_HZ` scales.
    const broadcastBytes = JSON.stringify(sent[ROOM_PLAYER_ID]![0]).length;
    expect(stats.broadcastBytesPerSec).toBeCloseTo((broadcastBytes / SNAPSHOT_EVERY_TICKS) * TICK_HZ, 1);
  });

  it('#714: counts the off-tick frames, a step closing frame and a republish, in the bandwidth', () => {
    const sent: SentLog = {};
    const room = new GameRoom(createSpyGameModule(), roomOptions(), createManualRoomTiming());
    room.addPlayer(createTestConnection({ playerId: ROOM_PLAYER_ID, sent }));
    room.start();
    room.step(SNAPSHOT_EVERY_TICKS + TICKS_PAST_A_BOUNDARY);
    room.republishSnapshot();
    // Ends on a broadcast tick, so every frame sent so far is on a tick record: the two off-tick ones on the next.
    room.step(SNAPSHOT_EVERY_TICKS - TICKS_PAST_A_BOUNDARY);

    const frames = sent[ROOM_PLAYER_ID]!;
    const bytesSent = frames.reduce<number>((sum, message) => sum + JSON.stringify(message).length, 0);
    const stats = room.performanceTracker.getStats();
    expect(frames).toHaveLength(INTERVALS_TO_SAMPLE_BYTES + OFF_TICK_FRAMES);
    expect(stats.sampleCount).toBe(INTERVALS_TO_SAMPLE_BYTES * SNAPSHOT_EVERY_TICKS);
    expect(stats.broadcastBytesPerSec).toBe(roundToHundredths((bytesSent / stats.sampleCount) * TICK_HZ));
  });

  it('step() past a cadence boundary still broadcasts the frame it stopped on', () => {
    const sent: SentLog = {};
    const room = new GameRoom(createDrainingGameModule(), roomOptions(), createManualRoomTiming());
    room.addPlayer(createTestConnection({ playerId: ROOM_PLAYER_ID, sent }));
    room.start();
    room.step(SNAPSHOT_EVERY_TICKS + TICKS_PAST_A_BOUNDARY);
    expect(room.getTickCount()).toBe(SNAPSHOT_EVERY_TICKS + TICKS_PAST_A_BOUNDARY);
    expect(broadcastMoments(sent, ROOM_PLAYER_ID)).toEqual(
      Array.from({ length: SNAPSHOT_EVERY_TICKS + TICKS_PAST_A_BOUNDARY }, (_unused, index) => index + 1),
    );
  });
});

describe('game-room: the cadence against the #266 flow control', () => {
  /** A started room with one connection on a module whose snapshots carry a tick the backlog can read. */
  function flowControlledRoom() {
    const sent: SentLog = {};
    const timing = createManualRoomTiming();
    const room = new GameRoom(createDrainingGameModule(), roomOptions(), timing);
    room.addPlayer(createTestConnection({ playerId: ROOM_PLAYER_ID, sent }));
    room.start();
    const fireOneTick = () => {
      timing.clock.advanceMilliseconds(TICK_INTERVAL_MS);
      timing.ticker.fire();
    };
    return { room, sent, fireOneTick };
  }

  it('never skips a client acknowledging on its own cadence, three ticks to the broadcast', () => {
    const { room, sent, fireOneTick } = flowControlledRoom();
    let acknowledged = 0;
    for (let tick = 0; tick < SNAPSHOT_BACKLOG_LIMIT_TICKS * RUNS_OF_THE_LIMIT; tick += 1) {
      fireOneTick();
      // The client applies what arrived and acknowledges on the wire cadence, with no round trip.
      const received = broadcastTicks(sent, ROOM_PLAYER_ID);
      if (received.length > acknowledged && received.length % SNAPSHOT_ACK_EVERY_SNAPSHOTS === 0) {
        acknowledged = received.length;
        room.recordSnapshotAck(ROOM_PLAYER_ID, received.at(-1)!);
      }
    }
    expect(room.snapshotBacklog.owedCount()).toBe(0);
    expect(room.snapshotBacklog.resyncCount()).toBe(0);
    expect(broadcastTicks(sent, ROOM_PLAYER_ID)).toHaveLength(
      (SNAPSHOT_BACKLOG_LIMIT_TICKS * RUNS_OF_THE_LIMIT) / SNAPSHOT_EVERY_TICKS,
    );
    expect(room.snapshotBacklog.backlogTicksOf(ROOM_PLAYER_ID)).toBeLessThanOrEqual(SNAPSHOT_ACK_EVERY_TICKS);
  });

  it('still stops a silent client at the limit, overshooting it by at most one broadcast interval', () => {
    const { room, sent, fireOneTick } = flowControlledRoom();
    for (let tick = 0; tick < SNAPSHOT_EVERY_TICKS; tick += 1) fireOneTick();
    const acknowledgedTick = broadcastTicks(sent, ROOM_PLAYER_ID).at(-1)!;
    room.recordSnapshotAck(ROOM_PLAYER_ID, acknowledgedTick);

    // The client says nothing more; the room keeps sending until the depth passes the limit.
    for (let tick = 0; tick < SNAPSHOT_BACKLOG_LIMIT_TICKS * RUNS_OF_THE_LIMIT; tick += 1) fireOneTick();

    expect(room.snapshotBacklog.owedCount()).toBe(1);
    const depthWhenStopped = broadcastTicks(sent, ROOM_PLAYER_ID).at(-1)! - acknowledgedTick;
    expect(depthWhenStopped).toBeGreaterThan(SNAPSHOT_BACKLOG_LIMIT_TICKS);
    // The check runs on broadcast ticks, so a coarser cadence is a coarser check — by one interval, no more.
    expect(depthWhenStopped).toBeLessThanOrEqual(SNAPSHOT_BACKLOG_LIMIT_TICKS + SNAPSHOT_EVERY_TICKS);
  });
});
