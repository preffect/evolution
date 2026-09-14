// Real-socket test support (docs/testing/tiers-and-builders.md §4): a Fastify server with the `/ws` route on an
// ephemeral port, the promises a raw `ws` client needs, and the lobby harness the lobby integration tests drive
// rooms through. Used by the integration tier only; the unit tier fakes the socket (`bot-builders.ts`).
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { WebSocket } from 'ws';
import {
  CLIENT_MESSAGE_TYPE,
  SERVER_MESSAGE_TYPE,
  TICK_INTERVAL_MS,
  createTestSessionConfig,
  type ClientMessage,
  type LobbyGameInfo,
  type ServerMessage,
} from '@evolution/shared';
import type { GameModuleFactory } from '../game/game-module.js';
import type { GameRoom } from '../lobby/game-room.js';
import { LobbyManager } from '../lobby/lobby-manager.js';
import type { RoomTimingFactory } from '../lobby/room-timing.js';
import type { Connection } from '../ws/connection.js';
import { registerWebSocketHandler } from '../ws/websocket-handler.js';
import { createManualRoomTiming, spyGameModuleFactory, type ManualRoomTiming } from './builders.js';

const EPHEMERAL_PORT = 0;
const LOOPBACK_HOST = '127.0.0.1';
const LOBBY_HARNESS_MAX_PLAYERS = 4;

export interface TestWebSocketServerOptions {
  gameFactory?: GameModuleFactory;
  createRoomTiming?: RoomTimingFactory;
}

export interface TestWebSocketServer {
  readonly server: FastifyInstance;
  /** The `/ws` endpoint, `ws://127.0.0.1:<port>/ws`. */
  readonly url: string;
  readonly lobby: LobbyManager;
  readonly connections: Map<string, Connection>;
  close(): Promise<void>;
}

/** A listening server whose `/ws` route runs the real router and lobby over the given module and timing. */
export async function startTestWebSocketServer(options: TestWebSocketServerOptions = {}): Promise<TestWebSocketServer> {
  const { gameFactory = spyGameModuleFactory, createRoomTiming = createManualRoomTiming } = options;
  const server = Fastify();
  await server.register(fastifyWebsocket);
  const lobby = new LobbyManager(gameFactory, createRoomTiming);
  const connections = new Map<string, Connection>();
  registerWebSocketHandler(server, {
    connections,
    handlers: lobby.createHandlers(connections),
    onConnect: (connection) => lobby.handleConnect(connection, connections),
    onDisconnect: (connection) => lobby.handleDisconnect(connection),
  });
  await server.listen({ port: EPHEMERAL_PORT, host: LOOPBACK_HOST });
  const address = server.addresses()[0]!;
  return {
    server,
    url: `ws://${LOOPBACK_HOST}:${address.port}/ws`,
    lobby,
    connections,
    close: () => server.close(),
  };
}

export function openTestSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

/**
 * A socket whose messages are recorded from the moment it exists. The server speaks first on a
 * reconnect (`game_state`, docs/architecture/wire-contract.md §4), so a listener attached after `open` resolves
 * can miss it; this attaches before the socket can receive anything.
 */
export function openRecordingTestSocket(url: string): Promise<{ socket: WebSocket; received: ServerMessage[] }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const received: ServerMessage[] = [];
    socket.on('message', (data: Buffer) => received.push(JSON.parse(data.toString()) as ServerMessage));
    socket.once('open', () => resolve({ socket, received }));
    socket.once('error', reject);
  });
}

export function nextServerMessage(socket: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve) => socket.once('message', (data) => resolve(JSON.parse(data.toString()))));
}

export function whenClosed(socket: WebSocket): Promise<void> {
  return new Promise((resolve) => socket.once('close', () => resolve()));
}

// ---- the lobby harness ---------------------------------------------------------------------

export type MessagePredicate = (message: ServerMessage) => boolean;

/** A recording socket with the identity it connected as. */
export interface TestClient {
  readonly clientId: string;
  readonly socket: WebSocket;
  readonly received: ServerMessage[];
}

/** Resolves with the next message the socket receives after this call that `isAwaited` accepts. */
export function nextMatchingMessage(socket: WebSocket, isAwaited: MessagePredicate): Promise<ServerMessage> {
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

export function messageOfType(type: string): MessagePredicate {
  return (message) => message.type === type;
}

/**
 * A `lobby_update` whose list passes `isShown`. Every lobby change is broadcast to every socket, so a bare
 * `lobby_update` may be another client's earlier change still in flight; waiting for the list the frame produces
 * is what shows the server has handled it.
 */
export function lobbyShows(isShown: (games: readonly LobbyGameInfo[]) => boolean): MessagePredicate {
  return (message) => message.type === SERVER_MESSAGE_TYPE.lobbyUpdate && isShown(message.games);
}

export function isSeated(games: readonly LobbyGameInfo[], gameId: string, clientId: string): boolean {
  return games.some((game) => game.gameId === gameId && game.players.some((player) => player.playerId === clientId));
}

export async function sendAndAwait(client: TestClient, frame: ClientMessage, isAwaited: MessagePredicate) {
  const awaited = nextMatchingMessage(client.socket, isAwaited);
  client.socket.send(JSON.stringify(frame));
  return awaited;
}

/** A test server whose rooms run on manual timing, with every client it connected. */
export interface LobbySocketHarness {
  readonly started: TestWebSocketServer;
  /** Each room's timing, in the order the rooms were started. */
  readonly timings: ManualRoomTiming[];
  readonly clients: TestClient[];
}

export async function startLobbySocketHarness(): Promise<LobbySocketHarness> {
  const timings: ManualRoomTiming[] = [];
  const started = await startTestWebSocketServer({
    createRoomTiming: () => {
      const timing = createManualRoomTiming();
      timings.push(timing);
      return timing;
    },
  });
  return { started, timings, clients: [] };
}

/** Closes every client socket, then the server. */
export async function closeLobbySocketHarness(harness: LobbySocketHarness): Promise<void> {
  for (const client of harness.clients) {
    client.socket.close();
    await whenClosed(client.socket);
  }
  await harness.started.close();
}

/** Connects as `clientId` and joins the lobby under that name. */
export async function connectTestClient(harness: LobbySocketHarness, clientId: string): Promise<TestClient> {
  const recording = await openRecordingTestSocket(`${harness.started.url}?clientId=${clientId}`);
  const client = { clientId, ...recording };
  harness.clients.push(client);
  const joinLobby = { type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: clientId, avatarIndex: 0 } as const;
  await sendAndAwait(client, joinLobby, messageOfType(SERVER_MESSAGE_TYPE.lobbyUpdate));
  return client;
}

/** Creates a pending game hosted by `host` and seats `guests` in it; returns its id. */
export async function createTestRoom(
  harness: LobbySocketHarness,
  host: TestClient,
  gameName: string,
  guests: TestClient[] = [],
): Promise<string> {
  const config = createTestSessionConfig({ maxPlayers: LOBBY_HARNESS_MAX_PLAYERS });
  const isListed = lobbyShows((games) => games.some((game) => game.gameName === gameName));
  await sendAndAwait(host, { type: CLIENT_MESSAGE_TYPE.createGame, gameName, config }, isListed);
  const gameId = harness.started.lobby.listGames().find((game) => game.gameName === gameName)!.gameId;
  for (const guest of guests) {
    const joinGame = { type: CLIENT_MESSAGE_TYPE.joinGame, gameId } as const;
    await sendAndAwait(
      guest,
      joinGame,
      lobbyShows((games) => isSeated(games, gameId, guest.clientId)),
    );
  }
  return gameId;
}

/** `createTestRoom`, then starts it; returns its id, timing and room. */
export async function startTestRoom(
  harness: LobbySocketHarness,
  host: TestClient,
  gameName: string,
  guests: TestClient[] = [],
): Promise<{ gameId: string; timing: ManualRoomTiming; room: GameRoom }> {
  const gameId = await createTestRoom(harness, host, gameName, guests);
  const startGame = { type: CLIENT_MESSAGE_TYPE.startGame, gameId } as const;
  await sendAndAwait(host, startGame, messageOfType(SERVER_MESSAGE_TYPE.gameState));
  return { gameId, timing: harness.timings.at(-1)!, room: harness.started.lobby.getActiveRoom(gameId)! };
}

/** Runs `ticks` room ticks on manual timing. */
export function advanceRoomTicks(timing: ManualRoomTiming, ticks: number): void {
  for (let count = 0; count < ticks; count += 1) {
    timing.clock.advanceMilliseconds(TICK_INTERVAL_MS);
    timing.ticker.fire();
  }
}
