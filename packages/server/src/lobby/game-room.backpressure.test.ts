// Unit (docs/testing/tiers-and-builders.md §2): `GameRoom`'s side of the snapshot backpressure of
// docs/architecture/wire-contract.md §4 (#266) — who is sent this broadcast's delta, who is sent a `game_state`
// instead, and who is sent nothing. The decision itself is `snapshot-backlog.test.ts`; the wire is
// `reconnect-snapshots.integration.test.ts`.
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BALANCE,
  SERVER_MESSAGE_TYPE,
  SNAPSHOT_BACKLOG_LIMIT_BYTES,
  SNAPSHOT_BACKLOG_LIMIT_TICKS,
  SNAPSHOT_EVERY_TICKS,
  TICK_HZ,
  createTestSessionConfig,
  gameId,
} from '@evolution/shared';
import type { PlayerId } from '@evolution/shared';
import { GameRoom } from './game-room.js';
import { roundToHundredths } from './performance-tracker.js';
import type { RoomInitOptions } from '../game/game-module.js';
import {
  createManualRoomTiming,
  createSpyGameModule,
  createTestConnection,
  createTickingGameModule,
  setBufferedAmount,
} from '../testing/builders.js';

const SATURATED_BYTES = SNAPSHOT_BACKLOG_LIMIT_BYTES + 1;

function roomOptions(playerIds: string[]): RoomInitOptions {
  return {
    gameId: gameId('g1'),
    creatorId: playerIds[0] as PlayerId,
    playerIds: playerIds as PlayerId[],
    gameName: 'Test',
    config: createTestSessionConfig({ maxPlayers: 4 }),
    avatarAssignments: Object.fromEntries(playerIds.map((playerId, index) => [playerId, index])),
    playerNames: {},
  };
}

describe('game-room: snapshot flow control by acknowledged tick (#266, docs/architecture/wire-contract.md §4)', () => {
  /** A started room whose one player acknowledges ticks by hand. */
  function tickingRoom() {
    const sent: Record<string, unknown[]> = {};
    const room = new GameRoom(createTickingGameModule(), roomOptions(['p1']), createManualRoomTiming());
    room.addPlayer(createTestConnection({ playerId: 'p1', sent }));
    room.start();
    const typesSent = () => (sent['p1'] as { type: string }[]).map((message) => message.type);
    /** The tick of the newest message sent, as the client would acknowledge it. */
    const lastSentMessage = () => sent['p1']!.at(-1);
    const lastSentTick = () => (lastSentMessage() as { snapshot: { tick: number } }).snapshot.tick;
    return { room, typesSent, lastSentMessage, lastSentTick };
  }

  it('keeps sending deltas to a client that acknowledges what it is sent', () => {
    const { room, typesSent } = tickingRoom();
    for (let tick = 1; tick <= SNAPSHOT_BACKLOG_LIMIT_TICKS * 2; tick += 1) {
      room.step(SNAPSHOT_EVERY_TICKS);
      room.recordSnapshotAck('p1', tick);
    }
    expect(typesSent()).toHaveLength(SNAPSHOT_BACKLOG_LIMIT_TICKS * 2);
    expect(typesSent().every((type) => type === SERVER_MESSAGE_TYPE.gameSnapshot)).toBe(true);
    expect(room.snapshotBacklog.resyncCount()).toBe(0);
  });

  it('stops sending once more than SNAPSHOT_BACKLOG_LIMIT_TICKS is in flight, and resyncs when the client catches up', () => {
    const { room, typesSent, lastSentMessage, lastSentTick } = tickingRoom();
    const acknowledged = 1;
    room.step(SNAPSHOT_EVERY_TICKS);
    room.recordSnapshotAck('p1', acknowledged);
    room.step(SNAPSHOT_EVERY_TICKS * (SNAPSHOT_BACKLOG_LIMIT_TICKS * 2));

    // It keeps sending until the depth passes the limit: the acknowledged tick plus one limit's worth.
    const lastTickSent = acknowledged + SNAPSHOT_BACKLOG_LIMIT_TICKS + 1;
    const sentWhileBehind = typesSent().length;
    expect(sentWhileBehind).toBe(lastTickSent);
    expect(room.snapshotBacklog.owedCount()).toBe(1);
    expect(room.snapshotBacklog.backlogTicksOf('p1')).toBe(SNAPSHOT_BACKLOG_LIMIT_TICKS + 1);

    // The client drains the queue and says so. The room is paused (a step pauses it) and will broadcast nothing, so
    // the ack itself rebuilds the whole view (#300); the next broadcast is an ordinary delta again.
    const recordResyncBytes = vi.spyOn(room.performanceTracker, 'recordResyncBytes');
    room.recordSnapshotAck('p1', lastTickSent);
    expect(typesSent().slice(sentWhileBehind)).toEqual([SERVER_MESSAGE_TYPE.gameState]);
    expect(room.snapshotBacklog.resyncCount()).toBe(1);
    // Its bytes are measured like a broadcast's resync (#276).
    expect(recordResyncBytes).toHaveBeenCalledExactlyOnceWith(JSON.stringify(lastSentMessage()).length);
    // Nothing more until the client acknowledges that game_state (#275), then ordinary deltas again.
    room.recordSnapshotAck('p1', lastSentTick());
    room.step(SNAPSHOT_EVERY_TICKS);
    expect(typesSent().slice(sentWhileBehind)).toEqual([
      SERVER_MESSAGE_TYPE.gameState,
      SERVER_MESSAGE_TYPE.gameSnapshot,
    ]);
  });

  it('#275: a step taken while a paused resync waits for its ack still reaches the client, as a delta behind it', () => {
    const { room, typesSent, lastSentTick } = tickingRoom();
    room.step(SNAPSHOT_EVERY_TICKS);
    room.recordSnapshotAck('p1', 1);
    room.step(SNAPSHOT_EVERY_TICKS * (SNAPSHOT_BACKLOG_LIMIT_TICKS + 2));
    const sentBeforeResync = typesSent().length;
    room.recordSnapshotAck('p1', sentBeforeResync);
    expect(typesSent().slice(sentBeforeResync)).toEqual([SERVER_MESSAGE_TYPE.gameState]);
    const heldResyncTick = lastSentTick();
    // A debug step lands before the client acknowledges that game_state. The paused room will make no next broadcast,
    // so the step's delta goes out, queued behind the resync: the client reaches the stepped tick.
    room.step(SNAPSHOT_EVERY_TICKS);
    expect(typesSent().slice(sentBeforeResync)).toEqual([
      SERVER_MESSAGE_TYPE.gameState,
      SERVER_MESSAGE_TYPE.gameSnapshot,
    ]);
    expect(lastSentTick()).toBeGreaterThan(heldResyncTick);
    // Nothing further is owed, and no second full state is armed: the acks settle nothing more.
    room.recordSnapshotAck('p1', heldResyncTick);
    room.recordSnapshotAck('p1', lastSentTick());
    expect(typesSent()).toHaveLength(sentBeforeResync + 2);
  });

  it('#300: a paused room stepped past the limit in one burst resyncs the client as soon as its ack catches up', () => {
    const { room, typesSent } = tickingRoom();
    room.step(SNAPSHOT_EVERY_TICKS);
    room.recordSnapshotAck('p1', 1);
    // The debug_step_room burst the ticket reproduced: 89 ticks at once, no ack can arrive inside it.
    room.step(89 * SNAPSHOT_EVERY_TICKS);
    const lastTickSent = 1 + SNAPSHOT_BACKLOG_LIMIT_TICKS + 1;
    expect(typesSent()).toHaveLength(lastTickSent);
    expect(room.snapshotBacklog.owedCount()).toBe(1);
    // An ack still more than the limit behind what was sent settles nothing.
    room.recordSnapshotAck('p1', lastTickSent - SNAPSHOT_BACKLOG_LIMIT_TICKS - 1);
    expect(typesSent()).toHaveLength(lastTickSent);
    // Caught up: the game_state goes now, once; a repeated ack sends nothing twice.
    room.recordSnapshotAck('p1', lastTickSent);
    room.recordSnapshotAck('p1', lastTickSent);
    expect(typesSent().slice(lastTickSent)).toEqual([SERVER_MESSAGE_TYPE.gameState]);
    expect(room.snapshotBacklog.owedCount()).toBe(0);
  });

  it('#300: a running room still settles the resync on its next broadcast, not on the ack', () => {
    const { room, typesSent } = tickingRoom();
    room.step(SNAPSHOT_EVERY_TICKS);
    room.recordSnapshotAck('p1', 1);
    room.step(89 * SNAPSHOT_EVERY_TICKS);
    const sentWhileBehind = typesSent().length;
    room.resume();
    room.recordSnapshotAck('p1', sentWhileBehind);
    expect(typesSent()).toHaveLength(sentWhileBehind);
    room.step(SNAPSHOT_EVERY_TICKS);
    expect(typesSent().slice(sentWhileBehind)).toEqual([SERVER_MESSAGE_TYPE.gameState]);
  });

  it('never skips a client that has acknowledged nothing at all (the headless bot client)', () => {
    const { room, typesSent } = tickingRoom();
    room.step(SNAPSHOT_EVERY_TICKS * (SNAPSHOT_BACKLOG_LIMIT_TICKS * 2));
    expect(typesSent()).toHaveLength(SNAPSHOT_BACKLOG_LIMIT_TICKS * 2);
    expect(room.snapshotBacklog.owedCount()).toBe(0);
  });

  it('forgets what a reattached player was sent and acknowledged: the reconnect game_state is the new start', () => {
    const { room } = tickingRoom();
    room.step(SNAPSHOT_EVERY_TICKS);
    room.recordSnapshotAck('p1', 1);
    expect(room.snapshotBacklog.backlogTicksOf('p1')).toBe(0);
    room.reattachPlayer(createTestConnection({ playerId: 'p1' }));
    expect(room.snapshotBacklog.backlogTicksOf('p1')).toBeNull();
  });
});

describe('game-room: snapshot backpressure on unsent bytes (#266, docs/architecture/wire-contract.md §4)', () => {
  /** A started room with one player whose socket the test drains or backs up. */
  function roomWithOnePlayer() {
    const sent: Record<string, unknown[]> = {};
    const gameModule = createSpyGameModule();
    const room = new GameRoom(gameModule, roomOptions(['p1']), createManualRoomTiming());
    const connection = createTestConnection({ playerId: 'p1', sent });
    room.addPlayer(connection);
    room.start();
    const typesSent = () => (sent['p1'] as { type: string }[]).map((message) => message.type);
    return { room, connection, typesSent };
  }

  it('sends nothing to a connection that has not drained its socket', () => {
    const fixture = roomWithOnePlayer();
    setBufferedAmount(fixture.connection, SATURATED_BYTES);
    fixture.room.step(SNAPSHOT_EVERY_TICKS * 3);
    expect(fixture.typesSent()).toEqual([]);
    expect(fixture.room.snapshotBacklog.owedCount()).toBe(1);
  });

  it('sends one game_state in place of the next delta once the connection drains', () => {
    const fixture = roomWithOnePlayer();
    setBufferedAmount(fixture.connection, SATURATED_BYTES);
    fixture.room.step(SNAPSHOT_EVERY_TICKS);
    setBufferedAmount(fixture.connection, 0);
    fixture.room.step(SNAPSHOT_EVERY_TICKS * 2);
    // One resync for the ticks it missed, then the delta stream again.
    expect(fixture.typesSent()).toEqual([SERVER_MESSAGE_TYPE.gameState, SERVER_MESSAGE_TYPE.gameSnapshot]);
    expect(fixture.room.snapshotBacklog.resyncCount()).toBe(1);
  });

  it('addresses the resync with the room own game id and the full state, like any other game_state', () => {
    const sent: Record<string, unknown[]> = {};
    const gameModule = createSpyGameModule();
    const room = new GameRoom(gameModule, roomOptions(['p1']), createManualRoomTiming());
    const connection = createTestConnection({ playerId: 'p1', sent, bufferedAmount: SATURATED_BYTES });
    room.addPlayer(connection);
    room.start();
    room.step(SNAPSHOT_EVERY_TICKS);
    setBufferedAmount(connection, 0);
    room.step(SNAPSHOT_EVERY_TICKS);
    expect(sent['p1']![0]).toEqual(
      expect.objectContaining({
        type: SERVER_MESSAGE_TYPE.gameState,
        gameId: gameId('g1'),
        playerId: 'p1',
        balance: DEFAULT_BALANCE,
      }),
    );
  });

  it('steps the world on every broadcast tick even when no one is sent the delta', () => {
    const sent: Record<string, unknown[]> = {};
    const gameModule = createSpyGameModule();
    const room = new GameRoom(gameModule, roomOptions(['p1']), createManualRoomTiming());
    const connection = createTestConnection({ playerId: 'p1', sent, bufferedAmount: SATURATED_BYTES });
    room.addPlayer(connection);
    room.start();
    room.step(SNAPSHOT_EVERY_TICKS * 2);
    // The one drain of the effects and the one step of the food delta tracker (docs/architecture/wire-contract.md §4).
    expect(gameModule.serializeRoomState).toHaveBeenCalledTimes(2);
    expect(sent['p1']).toEqual([]);
    // Nothing was sent, so nothing is counted: a skipped client costs no bandwidth (#276).
    expect(room.performanceTracker.getStats().broadcastBytesPerSec).toBe(0);
  });

  it('#276: counts every byte sent, the resync game_state included, and no delta for a skipped client', () => {
    const sent: Record<string, unknown[]> = {};
    const room = new GameRoom(createSpyGameModule(), roomOptions(['p1', 'p2']), createManualRoomTiming());
    const lagging = createTestConnection({ playerId: 'p1', sent, bufferedAmount: SATURATED_BYTES });
    room.addPlayer(lagging);
    room.addPlayer(createTestConnection({ playerId: 'p2', sent }));
    room.start();
    room.step(SNAPSHOT_EVERY_TICKS);
    setBufferedAmount(lagging, 0);
    room.step(SNAPSHOT_EVERY_TICKS);

    expect((sent['p1'] as { type: string }[]).map((message) => message.type)).toEqual([SERVER_MESSAGE_TYPE.gameState]);
    const bytesSent = [...sent['p1']!, ...sent['p2']!].reduce<number>(
      (sum, message) => sum + JSON.stringify(message).length,
      0,
    );
    const stats = room.performanceTracker.getStats();
    expect(stats.broadcastBytesPerSec).toBe(roundToHundredths((bytesSent / stats.sampleCount) * TICK_HZ));
  });

  it('a reconnect settles the resync the reattached player was owed', () => {
    const fixture = roomWithOnePlayer();
    setBufferedAmount(fixture.connection, SATURATED_BYTES);
    fixture.room.step(SNAPSHOT_EVERY_TICKS);
    expect(fixture.room.snapshotBacklog.owedCount()).toBe(1);
    fixture.room.reattachPlayer(createTestConnection({ playerId: 'p1' }));
    expect(fixture.room.snapshotBacklog.owedCount()).toBe(0);
  });

  it('a player who leaves is not remembered as owing a resync', () => {
    const fixture = roomWithOnePlayer();
    setBufferedAmount(fixture.connection, SATURATED_BYTES);
    fixture.room.step(SNAPSHOT_EVERY_TICKS);
    fixture.room.removePlayer('p1');
    expect(fixture.room.snapshotBacklog.owedCount()).toBe(0);
  });
});
