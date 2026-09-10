// Real-socket test support (docs/TESTING.md §4): a Fastify server with the `/ws` route on an
// ephemeral port, and the three promises a raw `ws` client needs. Used by the integration tier
// only; the unit tier fakes the socket (`bot-builders.ts`).
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { WebSocket } from 'ws';
import type { ServerMessage } from '@evolution/shared';
import type { GameModuleFactory } from '../game/game-module.js';
import { LobbyManager } from '../lobby/lobby-manager.js';
import type { RoomTimingFactory } from '../lobby/room-timing.js';
import type { Connection } from '../ws/connection.js';
import { registerWebSocketHandler } from '../ws/websocket-handler.js';
import { createManualRoomTiming, spyGameModuleFactory } from './builders.js';

const EPHEMERAL_PORT = 0;
const LOOPBACK_HOST = '127.0.0.1';

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

export function nextServerMessage(socket: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve) => socket.once('message', (data) => resolve(JSON.parse(data.toString()))));
}

export function whenClosed(socket: WebSocket): Promise<void> {
  return new Promise((resolve) => socket.once('close', () => resolve()));
}
