import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { LobbyManager } from './lobby/lobby-manager.js';
import { registerWebSocketHandler } from './ws/websocket-handler.js';
import type { Connection } from './ws/connection.js';
import { registerMcpEndpoint } from './mcp/mcp-server.js';
import {
  DEFAULT_SERVER_PORT,
  WEBSOCKET_DEFLATE_CONCURRENCY_LIMIT,
  WEBSOCKET_DEFLATE_LEVEL,
  WEBSOCKET_DEFLATE_THRESHOLD_BYTES,
} from '@evolution/shared';
import { defaultGameModuleFactory } from './game/game-module.js'; // TODO(init): swap for real factory

const PORT = Number(process.env.PORT) || DEFAULT_SERVER_PORT;
const LISTEN_HOST = '0.0.0.0';

async function main(): Promise<void> {
  const server = Fastify({ logger: true });

  await server.register(fastifyWebsocket, {
    options: {
      perMessageDeflate: {
        zlibDeflateOptions: { level: WEBSOCKET_DEFLATE_LEVEL },
        threshold: WEBSOCKET_DEFLATE_THRESHOLD_BYTES,
        concurrencyLimit: WEBSOCKET_DEFLATE_CONCURRENCY_LIMIT,
      },
    },
  });

  const lobbyManager = new LobbyManager(defaultGameModuleFactory);
  const connections = new Map<string, Connection>();
  const handlers = lobbyManager.createHandlers(connections);

  registerWebSocketHandler(server, {
    connections,
    handlers,
    onConnect: (connection) => lobbyManager.handleConnect(connection, connections),
    onDisconnect: (connection) => lobbyManager.handleDisconnect(connection),
  });

  server.get('/api/health', async () => ({ status: 'ok' }));

  // The /debug-mcp endpoint surfaces all game state to Claude via MCP.
  // TODO(init): wire `getRoomGameState` to expose real game state per room.
  registerMcpEndpoint(server, { lobbyManager, connections });

  await server.listen({ port: PORT, host: LISTEN_HOST });
}

main().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
