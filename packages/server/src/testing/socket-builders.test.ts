import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { SERVER_MESSAGE_TYPE, type ServerMessage } from '@evolution/shared';
import { nextServerMessage } from './socket-builders.js';

const EMPTY_LOBBY: ServerMessage = { type: SERVER_MESSAGE_TYPE.lobbyUpdate, games: [] };

/** A raw socket stand-in: `nextServerMessage` only listens for `message` and `close` and reads `readyState`. */
function fakeSocket(): { socket: WebSocket; emitter: EventEmitter } {
  const emitter = new EventEmitter();
  return { socket: emitter as unknown as WebSocket, emitter };
}

function receive(emitter: EventEmitter, message: ServerMessage): void {
  emitter.emit('message', Buffer.from(JSON.stringify(message)));
}

describe('nextServerMessage', () => {
  it('resolves with the next message received after the call, and stops listening', async () => {
    const { socket, emitter } = fakeSocket();
    const awaited = nextServerMessage(socket);
    receive(emitter, EMPTY_LOBBY);
    await expect(awaited).resolves.toEqual(EMPTY_LOBBY);
    expect(emitter.listenerCount('message')).toBe(0);
    expect(emitter.listenerCount('close')).toBe(0);
  });

  it('rejects naming what it waited for when the socket closes first, and stops listening', async () => {
    const { socket, emitter } = fakeSocket();
    const awaited = nextServerMessage(socket);
    emitter.emit('close');
    await expect(awaited).rejects.toThrow('the next server message never became true: the socket closed');
    expect(emitter.listenerCount('message')).toBe(0);
  });

  it('rejects at once when the socket is already closed', async () => {
    const { socket, emitter } = fakeSocket();
    Object.assign(emitter, { readyState: WebSocket.CLOSED });
    await expect(nextServerMessage(socket)).rejects.toThrow('the socket closed');
    expect(emitter.listenerCount('message')).toBe(0);
  });
});
