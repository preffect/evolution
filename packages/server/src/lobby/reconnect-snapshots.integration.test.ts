// Integration (docs/TESTING.md §2): a client that reloads into a running room, over real sockets
// and the real game module (its snapshots carry the world tick this asserts on),
// through the /ws route and the lobby into the room's broadcast loop. #266 measured a reconnected
// client whose view stopped tracking the server; what the room owes it is a `game_state` and then a
// delta stream that carries on past the tick it reconnected at (docs/architecture/wire-contract.md §4, docs/architecture/client.md §5), and
// a socket that is not draining must be skipped rather than queued deeper.
// Run with `./validate.sh integration`.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import {
  CLIENT_MESSAGE_TYPE,
  SERVER_MESSAGE_TYPE,
  SNAPSHOT_BACKLOG_LIMIT_BYTES,
  SNAPSHOT_BACKLOG_LIMIT_TICKS,
  SNAPSHOT_EVERY_TICKS,
  TICK_INTERVAL_MS,
  createTestSessionConfig,
  type GameSnapshot,
  type ServerMessage,
} from '@evolution/shared';
import { evolutionModuleFactory } from '../game/evolution-module.js';
import { createManualRoomTiming, type ManualRoomTiming } from '../testing/builders.js';
import { broadcastTickAtOrBefore } from '../testing/cadence-builders.js';
import {
  openRecordingTestSocket,
  startTestWebSocketServer,
  whenClosed,
  type TestWebSocketServer,
} from '../testing/socket-builders.js';

const CLIENT_ID = 'reloader';
/** The room broadcasts once per `SNAPSHOT_EVERY_TICKS`, so a test counts intervals and steps ticks. */
const INTERVALS_BEFORE_RELOAD = 5;
const INTERVALS_AFTER_RELOAD = 5;
const TICKS_BEFORE_RELOAD = INTERVALS_BEFORE_RELOAD * SNAPSHOT_EVERY_TICKS;
const TICKS_AFTER_RELOAD = INTERVALS_AFTER_RELOAD * SNAPSHOT_EVERY_TICKS;
/** The room's own `bufferedAmount` reading for a socket nobody is reading. */
const SATURATED_BYTES = SNAPSHOT_BACKLOG_LIMIT_BYTES + 1;

/** How often and how many times a wait below re-reads what it is waiting for. */
const WAIT_POLL_MS = 5;
const WAIT_ATTEMPTS = 400;

/**
 * Resolves when `predicate` holds. A test on the wire waits for two kinds of thing — a message that
 * has arrived and a decision the room has taken — and the second is announced by nothing, so this
 * polls rather than listening. It lives here rather than in `src/testing/` because the timer ban of
 * docs/DETERMINISM.md §1 is lifted for test files only.
 */
function waitFor(predicate: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const attempt = (attemptsLeft: number): void => {
      if (predicate()) {
        resolve();
        return;
      }
      if (attemptsLeft === 0) {
        reject(new Error('the expected message or room state never arrived'));
        return;
      }
      setTimeout(() => attempt(attemptsLeft - 1), WAIT_POLL_MS);
    };
    attempt(WAIT_ATTEMPTS);
  });
}

function messagesOfType(received: readonly ServerMessage[], type: string): ServerMessage[] {
  return received.filter((message) => message.type === type);
}

function snapshotTicks(received: readonly ServerMessage[]): number[] {
  return messagesOfType(received, SERVER_MESSAGE_TYPE.gameSnapshot).map(
    (message) => (message as { snapshot: GameSnapshot }).snapshot.tick,
  );
}

/** What the room reads off a socket: fixed here, the way a page that stopped reading looks. */
function pretendBufferedAmount(socket: WebSocket, bytes: number): void {
  Object.defineProperty(socket, 'bufferedAmount', { configurable: true, get: () => bytes });
}

describe('a client that reloads into a running room (#266)', () => {
  let started: TestWebSocketServer;
  let timing: ManualRoomTiming;

  beforeEach(async () => {
    timing = createManualRoomTiming();
    started = await startTestWebSocketServer({
      gameFactory: evolutionModuleFactory,
      createRoomTiming: () => timing,
    });
  });

  afterEach(async () => {
    await started.close();
  });

  /** Steps the room: it runs on the test's own clock, so nothing here waits on wall time. */
  function advance(ticks: number): void {
    for (let count = 0; count < ticks; count += 1) {
      timing.clock.advanceMilliseconds(TICK_INTERVAL_MS);
      timing.ticker.fire();
    }
  }

  /** A started room with one player, reached the way a client reaches it. */
  async function startedRoomWithOnePlayer(): Promise<{ socket: WebSocket; received: ServerMessage[] }> {
    const { socket, received } = await openRecordingTestSocket(`${started.url}?clientId=${CLIENT_ID}`);
    socket.send(JSON.stringify({ type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: 'Reloader', avatarIndex: 0 }));
    socket.send(
      JSON.stringify({
        type: CLIENT_MESSAGE_TYPE.createGame,
        gameName: 'reload',
        config: createTestSessionConfig({ maxPlayers: 2 }),
      }),
    );
    await waitFor(() => started.lobby.listGames().length > 0);
    const gameId = started.lobby.listGames()[0]!.gameId;
    socket.send(JSON.stringify({ type: CLIENT_MESSAGE_TYPE.startGame, gameId }));
    await waitFor(() => messagesOfType(received, SERVER_MESSAGE_TYPE.gameState).length > 0);
    return { socket, received };
  }

  function activeRoom() {
    return started.lobby.getActiveRoom(started.lobby.listGames()[0]!.gameId)!;
  }

  it('is sent a game_state and then a delta stream that carries on past the tick it reconnected at', async () => {
    const before = await startedRoomWithOnePlayer();
    advance(TICKS_BEFORE_RELOAD);
    await waitFor(() => snapshotTicks(before.received).length >= INTERVALS_BEFORE_RELOAD);
    expect(snapshotTicks(before.received).at(-1)).toBe(TICKS_BEFORE_RELOAD);

    // The reload: the page's socket goes, a new one arrives with the same clientId.
    before.socket.close();
    await whenClosed(before.socket);
    const after = await openRecordingTestSocket(`${started.url}?clientId=${CLIENT_ID}`);
    await waitFor(() => messagesOfType(after.received, SERVER_MESSAGE_TYPE.gameState).length > 0);

    const [resumed] = messagesOfType(after.received, SERVER_MESSAGE_TYPE.gameState);
    expect((resumed as { snapshot: GameSnapshot }).snapshot.tick).toBe(TICKS_BEFORE_RELOAD);

    advance(TICKS_AFTER_RELOAD);
    await waitFor(() => snapshotTicks(after.received).length >= INTERVALS_AFTER_RELOAD);
    expect(snapshotTicks(after.received).at(-1)).toBe(TICKS_BEFORE_RELOAD + TICKS_AFTER_RELOAD);

    after.socket.close();
    await whenClosed(after.socket);
  });

  it('keeps the reconnected player on the room broadcast, not on the socket that went away', async () => {
    const before = await startedRoomWithOnePlayer();
    const room = activeRoom();
    before.socket.close();
    await whenClosed(before.socket);
    const after = await openRecordingTestSocket(`${started.url}?clientId=${CLIENT_ID}`);
    await waitFor(() => messagesOfType(after.received, SERVER_MESSAGE_TYPE.gameState).length > 0);

    expect(room.playerConnections.get(CLIENT_ID)).toBe(started.connections.get(CLIENT_ID));
    expect(room.disconnectedPlayers.has(CLIENT_ID)).toBe(false);
    expect(room.snapshotBacklog.owedCount()).toBe(0);

    after.socket.close();
    await whenClosed(after.socket);
  });

  it('stops queueing deltas on a socket that is not draining, and resyncs it when it drains', async () => {
    const client = await startedRoomWithOnePlayer();
    const room = activeRoom();
    const connection = room.playerConnections.get(CLIENT_ID)!;
    pretendBufferedAmount(connection.socket, SATURATED_BYTES);
    const snapshotsBefore = snapshotTicks(client.received).length;

    advance(TICKS_BEFORE_RELOAD);
    expect(room.snapshotBacklog.owedCount()).toBe(1);
    expect(snapshotTicks(client.received).length).toBe(snapshotsBefore);

    pretendBufferedAmount(connection.socket, 0);
    // The next broadcast resyncs it with a `game_state`; the one after that is a delta again.
    const drainedTicks = SNAPSHOT_EVERY_TICKS * 2;
    advance(drainedTicks);
    await waitFor(() => messagesOfType(client.received, SERVER_MESSAGE_TYPE.gameState).length > 1);

    expect(room.snapshotBacklog.resyncCount()).toBe(1);
    expect(snapshotTicks(client.received).at(-1)).toBe(TICKS_BEFORE_RELOAD + drainedTicks);

    client.socket.close();
    await whenClosed(client.socket);
  });

  it('stops sending to a client whose acknowledgements fall a limit behind, and resyncs it when they catch up', async () => {
    const client = await startedRoomWithOnePlayer();
    const room = activeRoom();
    const acknowledgedTick = SNAPSHOT_EVERY_TICKS;
    advance(SNAPSHOT_EVERY_TICKS);
    await waitFor(() => snapshotTicks(client.received).length > 0);
    client.socket.send(JSON.stringify({ type: CLIENT_MESSAGE_TYPE.snapshotAck, tick: acknowledgedTick }));
    await waitFor(() => room.snapshotBacklog.backlogTicksOf(CLIENT_ID) !== null);

    // The client says nothing more: the room keeps sending until the in-flight depth passes the limit.
    advance(SNAPSHOT_BACKLOG_LIMIT_TICKS * 2);
    // The room sends one more broadcast after the depth reaches the limit, then skips.
    const lastTickSent = broadcastTickAtOrBefore(
      acknowledgedTick + SNAPSHOT_BACKLOG_LIMIT_TICKS + SNAPSHOT_EVERY_TICKS,
    );
    await waitFor(() => snapshotTicks(client.received).at(-1) === lastTickSent);
    expect(snapshotTicks(client.received).at(-1)).toBe(lastTickSent);
    expect(room.snapshotBacklog.owedCount()).toBe(1);

    client.socket.send(JSON.stringify({ type: CLIENT_MESSAGE_TYPE.snapshotAck, tick: lastTickSent }));
    await waitFor(() => room.snapshotBacklog.backlogTicksOf(CLIENT_ID) === 0);
    advance(SNAPSHOT_EVERY_TICKS);
    await waitFor(() => messagesOfType(client.received, SERVER_MESSAGE_TYPE.gameState).length > 1);
    expect(room.snapshotBacklog.resyncCount()).toBe(1);

    client.socket.close();
    await whenClosed(client.socket);
  });
});
