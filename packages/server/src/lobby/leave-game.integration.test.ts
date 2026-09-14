// Integration (docs/testing/tiers-and-builders.md §2): `leave_game` over real sockets, through the /ws route and
// the router into the lobby and the room's broadcast loop (#319, docs/architecture/wire-contract.md §4). The player
// who leaves is off the room at once: its socket hears no more of that room, the players left behind hear it go,
// and the same socket can join another room straight away. Run with `./validate.sh integration`.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import {
  CLIENT_MESSAGE_TYPE,
  SERVER_MESSAGE_TYPE,
  SNAPSHOT_EVERY_TICKS,
  TICK_INTERVAL_MS,
  createTestSessionConfig,
  type ClientMessage,
  type LobbyGameInfo,
  type ServerMessage,
} from '@evolution/shared';
import { createManualRoomTiming, type ManualRoomTiming } from '../testing/builders.js';
import {
  openRecordingTestSocket,
  startTestWebSocketServer,
  whenClosed,
  type TestWebSocketServer,
} from '../testing/socket-builders.js';

const MAX_PLAYERS = 4;

interface TestClient {
  readonly clientId: string;
  readonly socket: WebSocket;
  readonly received: ServerMessage[];
}

type MessagePredicate = (message: ServerMessage) => boolean;

/** Resolves with the next message the socket receives after this call that `isAwaited` accepts. */
function nextMessage(socket: WebSocket, isAwaited: MessagePredicate): Promise<ServerMessage> {
  return new Promise((resolve) => {
    const listener = (data: Buffer): void => {
      const message = JSON.parse(data.toString()) as ServerMessage;
      if (!isAwaited(message)) return;
      socket.off('message', listener);
      resolve(message);
    };
    socket.on('message', listener);
  });
}

function ofType(type: string): MessagePredicate {
  return (message) => message.type === type;
}

/**
 * A `lobby_update` whose list passes `isShown`. Every lobby change is broadcast to every socket, so a bare
 * `lobby_update` may be another client's earlier change still in flight; waiting for the list the frame produces
 * is what shows the server has handled it.
 */
function lobbyShows(isShown: (games: readonly LobbyGameInfo[]) => boolean): MessagePredicate {
  return (message) => message.type === SERVER_MESSAGE_TYPE.lobbyUpdate && isShown(message.games);
}

function isSeated(games: readonly LobbyGameInfo[], gameId: string, clientId: string): boolean {
  return games.some((game) => game.gameId === gameId && game.players.some((player) => player.playerId === clientId));
}

function countOfType(client: TestClient, type: string): number {
  return client.received.filter((message) => message.type === type).length;
}

async function sendAndAwait(client: TestClient, frame: ClientMessage, isAwaited: MessagePredicate) {
  const awaited = nextMessage(client.socket, isAwaited);
  client.socket.send(JSON.stringify(frame));
  return awaited;
}

describe('leave_game over the wire (#319)', () => {
  let started: TestWebSocketServer;
  /** Each room's timing, in the order the rooms were started. */
  let timings: ManualRoomTiming[];
  let clients: TestClient[];

  beforeEach(async () => {
    timings = [];
    clients = [];
    started = await startTestWebSocketServer({
      createRoomTiming: () => {
        const timing = createManualRoomTiming();
        timings.push(timing);
        return timing;
      },
    });
  });

  afterEach(async () => {
    for (const client of clients) {
      client.socket.close();
      await whenClosed(client.socket);
    }
    await started.close();
  });

  function advance(timing: ManualRoomTiming, ticks: number): void {
    for (let count = 0; count < ticks; count += 1) {
      timing.clock.advanceMilliseconds(TICK_INTERVAL_MS);
      timing.ticker.fire();
    }
  }

  async function connect(clientId: string): Promise<TestClient> {
    const client = { clientId, ...(await openRecordingTestSocket(`${started.url}?clientId=${clientId}`)) };
    clients.push(client);
    const joinLobby = { type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: clientId, avatarIndex: 0 } as const;
    await sendAndAwait(client, joinLobby, ofType(SERVER_MESSAGE_TYPE.lobbyUpdate));
    return client;
  }

  /** Creates a game hosted by `host`, seats `guests` in it and starts it; returns its id, timing and room. */
  async function startRoom(host: TestClient, gameName: string, guests: TestClient[] = []) {
    const config = createTestSessionConfig({ maxPlayers: MAX_PLAYERS });
    const isListed = lobbyShows((games) => games.some((game) => game.gameName === gameName));
    await sendAndAwait(host, { type: CLIENT_MESSAGE_TYPE.createGame, gameName, config }, isListed);
    const gameId = started.lobby.listGames().find((game) => game.gameName === gameName)!.gameId;
    for (const guest of guests) {
      const joinGame = { type: CLIENT_MESSAGE_TYPE.joinGame, gameId } as const;
      await sendAndAwait(
        guest,
        joinGame,
        lobbyShows((games) => isSeated(games, gameId, guest.clientId)),
      );
    }
    await sendAndAwait(host, { type: CLIENT_MESSAGE_TYPE.startGame, gameId }, ofType(SERVER_MESSAGE_TYPE.gameState));
    return { gameId, timing: timings.at(-1)!, room: started.lobby.getActiveRoom(gameId)! };
  }

  it('takes the leaving socket off the room broadcast and tells the players left behind', async () => {
    const alice = await connect('alice');
    const carol = await connect('carol');
    const { gameId, timing, room } = await startRoom(alice, 'left', [carol]);
    const firstSnapshot = nextMessage(alice.socket, ofType(SERVER_MESSAGE_TYPE.gameSnapshot));
    advance(timing, SNAPSHOT_EVERY_TICKS);
    await firstSnapshot;

    const heardLeaving = nextMessage(carol.socket, ofType(SERVER_MESSAGE_TYPE.playerDisconnected));
    const isGone = lobbyShows((games) => !isSeated(games, gameId, alice.clientId));
    await sendAndAwait(alice, { type: CLIENT_MESSAGE_TYPE.leaveGame, gameId }, isGone);
    expect(await heardLeaving).toEqual({ type: SERVER_MESSAGE_TYPE.playerDisconnected, playerId: 'alice' });
    expect(room.playerConnections.has('alice')).toBe(false);
    expect(room.allPlayerIds).toEqual(['carol']);

    const snapshotsBeforeLeaving = countOfType(alice, SERVER_MESSAGE_TYPE.gameSnapshot);
    const carolSnapshot = nextMessage(carol.socket, ofType(SERVER_MESSAGE_TYPE.gameSnapshot));
    advance(timing, SNAPSHOT_EVERY_TICKS);
    await carolSnapshot;
    // A round trip on alice's own socket: a snapshot the room had sent her would arrive before this answer.
    const joinLobby = { type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: 'alice', avatarIndex: 0 } as const;
    await sendAndAwait(alice, joinLobby, isGone);
    expect(countOfType(alice, SERVER_MESSAGE_TYPE.gameSnapshot)).toBe(snapshotsBeforeLeaving);
  });

  it('lets the socket that left join another room at once', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    const other = await startRoom(bob, 'other');
    const left = await startRoom(alice, 'left');

    const isClosed = lobbyShows((games) => !games.some((game) => game.gameId === left.gameId));
    await sendAndAwait(alice, { type: CLIENT_MESSAGE_TYPE.leaveGame, gameId: left.gameId }, isClosed);
    expect(started.lobby.getActiveRoom(left.gameId)).toBeUndefined();

    const isOtherRoomState: MessagePredicate = (message) =>
      message.type === SERVER_MESSAGE_TYPE.gameState && message.gameId === other.gameId;
    const joined = await sendAndAwait(
      alice,
      { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: other.gameId },
      isOtherRoomState,
    );
    expect(joined).toMatchObject({ playerId: 'alice' });
    expect(other.room.allPlayerIds).toEqual(['bob', 'alice']);

    const snapshot = nextMessage(alice.socket, ofType(SERVER_MESSAGE_TYPE.gameSnapshot));
    advance(other.timing, SNAPSHOT_EVERY_TICKS);
    await snapshot;
    expect(other.room.playerConnections.get('alice')).toBe(started.connections.get('alice'));
  });
});
