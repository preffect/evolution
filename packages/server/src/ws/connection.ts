import { WebSocket } from 'ws';
import type { ServerMessage } from '@evolution/shared';

/**
 * A live client connection. Generic transport-level concept — carries the
 * player's identity + lobby presence fields. No game-specific state lives here.
 */
export interface Connection {
  /** Stable identity (from ?clientId= or a freshly minted nanoid). */
  playerId: string;
  /** Display name chosen in the lobby. */
  playerName: string;
  /** Indexed avatar chosen in the lobby. */
  avatarIndex: number;
  /** The underlying socket. */
  socket: WebSocket;
  /**
   * Takeover flag. When a second tab connects with the same clientId we mark
   * the old connection as replaced so its close handler does NOT tear down
   * the player's lobby/room presence.
   */
  isReplaced?: boolean;
}

/** Write an already-serialised frame if the socket is open; true when it was written. */
function sendRaw(connection: Connection, data: string): boolean {
  if (connection.socket.readyState !== WebSocket.OPEN) return false;
  connection.socket.send(data);
  return true;
}

/** Send a single message to one connection (no-op if the socket is closed). Returns bytes sent. */
export function sendMessage(connection: Connection, message: ServerMessage): number {
  const data = JSON.stringify(message);
  return sendRaw(connection, data) ? data.length : 0;
}

/**
 * Broadcast a message to many connections. Serializes once and reuses the
 * string. Returns the byte length sent to a single client (for perf metrics).
 */
export function broadcastMessage(connections: Iterable<Connection>, message: ServerMessage): number {
  const data = JSON.stringify(message);
  for (const connection of connections) sendRaw(connection, data);
  return data.length;
}
