import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import type { Connection } from './connection.js';
import { createMessageRouter, type MessageHandlers } from './message-router.js';

export interface WebSocketContext {
  /** The shared registry of live connections, keyed by playerId. */
  connections: Map<string, Connection>;
  /** Lobby-provided message handlers. */
  handlers: MessageHandlers;
  /** Called after a connection is registered (cancel removal / reattach). */
  onConnect?: (connection: Connection) => void;
  /** Called when a connection closes for good (not on takeover). */
  onDisconnect?: (connection: Connection) => void;
}

/** The query parameter a socket names its identity with; the bot client sets it too (`testing/bot-client`). */
export const CLIENT_ID_QUERY_PARAMETER = 'clientId';
/** Only used to give `new URL` a base so the request path parses; the host is never read. */
const URL_PARSE_BASE = 'http://localhost';

/** The identity a socket asked for (`?clientId=`), or a freshly minted one. */
export function resolvePlayerId(requestUrl: string): string {
  const requestedId = new URL(requestUrl, URL_PARSE_BASE).searchParams.get(CLIENT_ID_QUERY_PARAMETER);
  return requestedId && requestedId.length > 0 ? requestedId : nanoid();
}

/** Takeover: a previous connection with the same id is replaced, not removed. */
export function replaceExistingConnection(existing: Connection | undefined): void {
  if (!existing) return;
  existing.isReplaced = true;
  try {
    existing.socket.close();
  } catch {
    // socket may already be closed
  }
}

/**
 * Mount the `/ws` route. Identity comes from `?clientId=` when present (enabling
 * reconnect + multi-tab takeover); otherwise a fresh nanoid is minted. When a
 * second connection arrives with an existing clientId, the previous socket is
 * marked replaced and closed so its disconnect handler is a no-op.
 */
export function registerWebSocketHandler(server: FastifyInstance, context: WebSocketContext): void {
  const route = createMessageRouter(context.handlers);

  server.get('/ws', { websocket: true }, (socket, request) => {
    const playerId = resolvePlayerId(request.url);
    const existing = context.connections.get(playerId);
    replaceExistingConnection(existing);

    const connection: Connection = {
      playerId,
      playerName: existing?.playerName ?? '',
      avatarIndex: existing?.avatarIndex ?? 0,
      socket,
    };
    context.connections.set(playerId, connection);
    context.onConnect?.(connection);

    socket.on('message', (data: Buffer) => {
      route(connection, data.toString());
    });

    socket.on('close', () => {
      // Only tear down if this is still the active connection for the id and it
      // was not superseded by a takeover.
      if (connection.isReplaced) return;
      if (context.connections.get(playerId) === connection) {
        context.connections.delete(playerId);
      }
      context.onDisconnect?.(connection);
    });

    socket.on('error', () => {
      // Errors are followed by a `close`; nothing extra to do here.
    });
  });
}
