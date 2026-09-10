// The `BotTransport` over a real socket: what the CLI and the integration test connect with.
// The socket is built by an injectable factory so the unit test drives the framing and the
// listener fan-out with a fake socket; only `openWebSocket` touches the `ws` package.

import { WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from '@evolution/shared';
import type { BotTransport } from './bot-transport.js';
import { BotClientError } from './errors.js';

/** The slice of a `ws` socket the transport uses; a fake in a test satisfies it with four events. */
export interface SocketLike {
  on(event: 'open', listener: () => void): unknown;
  on(event: 'message', listener: (data: { toString(): string }) => void): unknown;
  on(event: 'close', listener: () => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  send(data: string): void;
  close(): void;
}

export type SocketFactory = (url: string) => SocketLike;

const openWebSocket: SocketFactory = (url) => new WebSocket(url);

function transportOver(socket: SocketLike): BotTransport {
  const messageListeners: ((message: ServerMessage) => void)[] = [];
  const closeListeners: (() => void)[] = [];
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString()) as ServerMessage;
    for (const listener of messageListeners) listener(message);
  });
  socket.on('close', () => {
    for (const listener of closeListeners) listener();
  });
  return {
    send: (message: ClientMessage) => socket.send(JSON.stringify(message)),
    onMessage: (listener) => messageListeners.push(listener),
    onClose: (listener) => closeListeners.push(listener),
    close: () => socket.close(),
  };
}

/** Resolves once the socket is open; a failure before that rejects with `BotClientError`. */
export function createWebSocketTransport(
  url: string,
  createSocket: SocketFactory = openWebSocket,
): Promise<BotTransport> {
  return new Promise((resolve, reject) => {
    const socket = createSocket(url);
    let isOpen = false;
    socket.on('error', (error) => {
      if (!isOpen) reject(new BotClientError(`could not connect to ${url}: ${error.message}`));
    });
    socket.on('open', () => {
      isOpen = true;
      resolve(transportOver(socket));
    });
  });
}
