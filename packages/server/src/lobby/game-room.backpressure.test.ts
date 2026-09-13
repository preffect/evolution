// Unit (docs/TESTING.md §2): `GameRoom`'s side of the snapshot backpressure of
// docs/ARCHITECTURE.md §4 (#266) — who is sent this broadcast's delta, who is sent a `game_state`
// instead, and who is sent nothing. The decision itself is `snapshot-backlog.test.ts`; the wire is
// `reconnect-snapshots.integration.test.ts`.
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BALANCE,
  SERVER_MESSAGE_TYPE,
  SNAPSHOT_BACKLOG_LIMIT_BYTES,
  SNAPSHOT_BACKLOG_LIMIT_TICKS,
  SNAPSHOT_EVERY_TICKS,
  createTestSessionConfig,
  gameId,
} from '@evolution/shared';
import type { GameSnapshot, PlayerId } from '@evolution/shared';
import { GameRoom } from './game-room.js';
import type { RoomInitOptions } from '../game/game-module.js';
import {
  createManualRoomTiming,
  createSpyGameModule,
  createTestConnection,
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

/** A module whose snapshots carry a tick, which is what the client acknowledges and the room reads. */
function tickingGameModule() {
  const module = createSpyGameModule();
  let tick = 0;
  module.serializeRoomState = vi.fn(() => {
    tick += 1;
    return { tick } as unknown as GameSnapshot;
  });
  module.serializeFullState = vi.fn(() => ({
    snapshot: { tick } as unknown as GameSnapshot,
    balance: DEFAULT_BALANCE,
  }));
  return module;
}

describe('game-room: snapshot flow control by acknowledged tick (#266, docs/ARCHITECTURE.md §4)', () => {
  /** A started room whose one player acknowledges ticks by hand. */
  function tickingRoom() {
    const sent: Record<string, unknown[]> = {};
    const room = new GameRoom(tickingGameModule(), roomOptions(['p1']), createManualRoomTiming());
    room.addPlayer(createTestConnection({ playerId: 'p1', sent }));
    room.start();
    const typesSent = () => (sent['p1'] as { type: string }[]).map((message) => message.type);
    return { room, typesSent };
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
    const { room, typesSent } = tickingRoom();
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

    // The client drains the queue and says so: the next broadcast rebuilds its whole view.
    room.recordSnapshotAck('p1', lastTickSent);
    room.step(SNAPSHOT_EVERY_TICKS);
    expect(typesSent().slice(sentWhileBehind)).toEqual([SERVER_MESSAGE_TYPE.gameState]);
    expect(room.snapshotBacklog.resyncCount()).toBe(1);
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

describe('game-room: snapshot backpressure on unsent bytes (#266, docs/ARCHITECTURE.md §4)', () => {
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
    // The one drain of the effects and the one step of the food delta tracker (docs/ARCHITECTURE.md §4).
    expect(gameModule.serializeRoomState).toHaveBeenCalledTimes(2);
    expect(sent['p1']).toEqual([]);
    expect(room.performanceTracker.getStats().broadcastBytesPerSec).toBe(0);
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
