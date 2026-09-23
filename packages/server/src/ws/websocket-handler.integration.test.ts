// Integration (docs/testing/tiers-and-builders.md §2): the /ws route over a real socket pair, through the router
// into the lobby and back out as a broadcast. Run with `./validate.sh integration`.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLIENT_MESSAGE_TYPE, SERVER_MESSAGE_TYPE, SOCKET_CLOSE_CODE_REPLACED } from '@evolution/shared';
import {
  nextServerMessage,
  openTestSocket,
  startTestWebSocketServer,
  whenClosed,
  type TestWebSocketServer,
} from '../testing/socket-builders.js';

describe('/ws route', () => {
  let started: TestWebSocketServer;

  beforeEach(async () => {
    started = await startTestWebSocketServer();
  });

  afterEach(async () => {
    await started.close();
  });

  it('registers the connection under the requested clientId and answers join_lobby', async () => {
    const socket = await openTestSocket(`${started.url}?clientId=alice`);
    const reply = nextServerMessage(socket);
    socket.send(JSON.stringify({ type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: 'Alice', avatarIndex: 1 }));
    expect(await reply).toEqual({ type: SERVER_MESSAGE_TYPE.lobbyUpdate, games: [] });
    expect(started.connections.get('alice')).toMatchObject({ playerName: 'Alice', avatarIndex: 1 });
    socket.close();
    await whenClosed(socket);
  });

  it('a second socket with the same clientId takes over and the first close does not unregister it', async () => {
    const first = await openTestSocket(`${started.url}?clientId=alice`);
    const firstConnection = started.connections.get('alice');
    const firstClosed = new Promise<number>((resolve) => first.once('close', (code: number) => resolve(code)));
    const second = await openTestSocket(`${started.url}?clientId=alice`);
    // Over the wire, with the code the client reads as "do not reconnect" (#273).
    expect(await firstClosed).toBe(SOCKET_CLOSE_CODE_REPLACED);
    expect(firstConnection?.isReplaced).toBe(true);
    expect(started.connections.get('alice')).toBeDefined();
    expect(started.connections.get('alice')).not.toBe(firstConnection);
    expect(started.connections.size).toBe(1);
    second.close();
    await whenClosed(second);
    expect(started.connections.has('alice')).toBe(false);
  });

  it('replies with an error frame to malformed JSON', async () => {
    const socket = await openTestSocket(started.url);
    const reply = nextServerMessage(socket);
    socket.send('not json');
    expect(await reply).toEqual({ type: SERVER_MESSAGE_TYPE.error, message: 'Invalid JSON' });
    socket.close();
    await whenClosed(socket);
  });
});
