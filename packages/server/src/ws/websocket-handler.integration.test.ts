// Integration (docs/TESTING.md §2): the /ws route over a real socket pair, through the router
// into the lobby and back out as a broadcast. Run with `./validate.sh integration`.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { WebSocket } from 'ws';
import { CLIENT_MESSAGE_TYPE, SERVER_MESSAGE_TYPE } from '@evolution/shared';
import type { ServerMessage } from '@evolution/shared';
import { registerWebSocketHandler } from './websocket-handler.js';
import type { Connection } from './connection.js';
import { LobbyManager } from '../lobby/lobby-manager.js';
import { spyGameModuleFactory } from '../testing/builders.js';

const EPHEMERAL_PORT = 0;

async function startServer(): Promise<{ server: FastifyInstance; url: string; connections: Map<string, Connection> }> {
  const server = Fastify();
  await server.register(fastifyWebsocket);
  const lobbyManager = new LobbyManager(spyGameModuleFactory);
  const connections = new Map<string, Connection>();
  registerWebSocketHandler(server, {
    connections,
    handlers: lobbyManager.createHandlers(connections),
    onConnect: (connection) => lobbyManager.handleConnect(connection, connections),
    onDisconnect: (connection) => lobbyManager.handleDisconnect(connection),
  });
  await server.listen({ port: EPHEMERAL_PORT, host: '127.0.0.1' });
  const address = server.addresses()[0]!;
  return { server, url: `ws://127.0.0.1:${address.port}/ws`, connections };
}

function openSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

function nextMessage(socket: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve) => socket.once('message', (data) => resolve(JSON.parse(data.toString()))));
}

function closed(socket: WebSocket): Promise<void> {
  return new Promise((resolve) => socket.once('close', () => resolve()));
}

describe('/ws route', () => {
  let started: Awaited<ReturnType<typeof startServer>>;

  beforeEach(async () => {
    started = await startServer();
  });

  afterEach(async () => {
    await started.server.close();
  });

  it('registers the connection under the requested clientId and answers join_lobby', async () => {
    const socket = await openSocket(`${started.url}?clientId=alice`);
    const reply = nextMessage(socket);
    socket.send(JSON.stringify({ type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: 'Alice', avatarIndex: 1 }));
    expect(await reply).toEqual({ type: SERVER_MESSAGE_TYPE.lobbyUpdate, games: [] });
    expect(started.connections.get('alice')).toMatchObject({ playerName: 'Alice', avatarIndex: 1 });
    socket.close();
    await closed(socket);
  });

  it('a second socket with the same clientId takes over and the first close does not unregister it', async () => {
    const first = await openSocket(`${started.url}?clientId=alice`);
    const firstConnection = started.connections.get('alice');
    const firstClosed = closed(first);
    const second = await openSocket(`${started.url}?clientId=alice`);
    await firstClosed;
    expect(firstConnection?.isReplaced).toBe(true);
    expect(started.connections.get('alice')).toBeDefined();
    expect(started.connections.get('alice')).not.toBe(firstConnection);
    expect(started.connections.size).toBe(1);
    second.close();
    await closed(second);
    expect(started.connections.has('alice')).toBe(false);
  });

  it('replies with an error frame to malformed JSON', async () => {
    const socket = await openSocket(started.url);
    const reply = nextMessage(socket);
    socket.send('not json');
    expect(await reply).toEqual({ type: SERVER_MESSAGE_TYPE.error, message: 'Invalid JSON' });
    socket.close();
    await closed(socket);
  });
});
