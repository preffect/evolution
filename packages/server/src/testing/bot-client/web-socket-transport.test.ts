import { describe, expect, it } from 'vitest';
import { CLIENT_MESSAGE_TYPE, SERVER_MESSAGE_TYPE } from '@evolution/shared';
import type { ServerMessage } from '@evolution/shared';
import { createFakeSocket, type FakeSocket } from '../bot-builders.js';
import { BotClientError } from './errors.js';
import { createWebSocketTransport } from './web-socket-transport.js';

const URL_UNDER_TEST = 'ws://127.0.0.1:4400/ws?clientId=bot_1_0';

function opening() {
  let socket: FakeSocket | undefined;
  const transport = createWebSocketTransport(URL_UNDER_TEST, (url) => {
    socket = createFakeSocket(url);
    return socket;
  });
  return { transport, socket: socket! };
}

describe('web socket transport', () => {
  it('opens the socket at the URL and resolves once it is open', async () => {
    const { transport, socket } = opening();
    expect(socket.url).toBe(URL_UNDER_TEST);
    socket.emitOpen();
    await expect(transport).resolves.toBeDefined();
  });

  it('rejects with a BotClientError when the socket fails before opening', async () => {
    const { transport, socket } = opening();
    socket.emitError(new Error('ECONNREFUSED'));
    await expect(transport).rejects.toThrow(BotClientError);
    await expect(transport).rejects.toThrow(
      /could not connect to ws:\/\/127.0.0.1:4400\/ws\?clientId=bot_1_0: ECONNREFUSED/,
    );
  });

  it('frames outbound messages as JSON and decodes inbound frames for every listener', async () => {
    const { transport, socket } = opening();
    socket.emitOpen();
    const opened = await transport;
    opened.send({ type: CLIENT_MESSAGE_TYPE.joinGame, gameId: 'g1' });
    expect(socket.sentFrames).toEqual([JSON.stringify({ type: CLIENT_MESSAGE_TYPE.joinGame, gameId: 'g1' })]);
    const received: ServerMessage[][] = [[], []];
    opened.onMessage((message) => received[0]!.push(message));
    opened.onMessage((message) => received[1]!.push(message));
    const frame: ServerMessage = { type: SERVER_MESSAGE_TYPE.error, message: 'nope' };
    socket.emitMessage(JSON.stringify(frame));
    expect(received).toEqual([[frame], [frame]]);
  });

  it('reports a close to every close listener and closes the socket on close()', async () => {
    const { transport, socket } = opening();
    socket.emitOpen();
    const opened = await transport;
    let closes = 0;
    opened.onClose(() => {
      closes += 1;
    });
    socket.emitClose();
    expect(closes).toBe(1);
    opened.close();
    expect(socket.isClosed()).toBe(true);
  });

  it('ignores a socket error after the transport opened (a close follows it)', async () => {
    const { transport, socket } = opening();
    socket.emitOpen();
    await transport;
    expect(() => socket.emitError(new Error('reset'))).not.toThrow();
  });
});
