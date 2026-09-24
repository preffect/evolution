import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import {
  CLIENT_MESSAGE_TYPE,
  SERVER_MESSAGE_TYPE,
  playerId,
  type ClientMessage,
  type ServerMessage,
} from '@evolution/shared';
import { lobbyShows, messageOfType, nextMatchingMessage, sendAndAwait, type TestClient } from './socket-messages.js';

const EMPTY_LOBBY: ServerMessage = { type: SERVER_MESSAGE_TYPE.lobbyUpdate, games: [] };
const DROPPED: ServerMessage = { type: SERVER_MESSAGE_TYPE.playerDisconnected, playerId: playerId('bob') };
const JOIN_LOBBY: ClientMessage = { type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: 'alice', avatarIndex: 0 };

/** A recording socket stand-in: records what it is sent, and receives what `receive` hands it, as a `ws` frame. */
class FakeClient extends EventEmitter implements TestClient {
  readonly clientId = 'alice';
  readonly received: ServerMessage[] = [];
  readonly sent: string[] = [];
  readonly socket = this as unknown as WebSocket;
  /** The reply the next `send` is answered with before it returns, as a server that answers at once would. */
  answerWith: ServerMessage | undefined;

  send(frame: string): void {
    this.sent.push(frame);
    if (this.answerWith) this.receive(this.answerWith);
  }

  receive(message: ServerMessage): void {
    this.received.push(message);
    this.emit('message', Buffer.from(JSON.stringify(message)));
  }
}

describe('nextMatchingMessage', () => {
  it('resolves with the first accepted message recorded after the call, and stops listening', async () => {
    const client = new FakeClient();
    client.receive(DROPPED);
    const awaited = nextMatchingMessage(client, messageOfType(SERVER_MESSAGE_TYPE.playerDisconnected));
    client.receive(EMPTY_LOBBY);
    const secondDrop: ServerMessage = { type: SERVER_MESSAGE_TYPE.playerDisconnected, playerId: playerId('carol') };
    client.receive(secondDrop);
    await expect(awaited).resolves.toBe(secondDrop);
    expect(client.listenerCount('message')).toBe(0);
    expect(client.listenerCount('close')).toBe(0);
  });

  it('resolves with a reply recorded before the wait was made, from the index it was told to start at', async () => {
    const client = new FakeClient();
    const firstIndex = client.received.length;
    client.receive(EMPTY_LOBBY);
    await expect(nextMatchingMessage(client, messageOfType(SERVER_MESSAGE_TYPE.lobbyUpdate), firstIndex)).resolves.toBe(
      EMPTY_LOBBY,
    );
  });

  it('rejects naming the awaited message when the socket closes first', async () => {
    const client = new FakeClient();
    const awaited = nextMatchingMessage(client, messageOfType(SERVER_MESSAGE_TYPE.playerDisconnected));
    client.emit('close');
    await expect(awaited).rejects.toThrow(
      `a ${SERVER_MESSAGE_TYPE.playerDisconnected} from message 0 never became true: the socket closed`,
    );
  });
});

describe('sendAndAwait', () => {
  it('sends the frame and resolves with a reply that arrives before the send returns', async () => {
    const client = new FakeClient();
    client.receive(EMPTY_LOBBY);
    const reply: ServerMessage = { type: SERVER_MESSAGE_TYPE.lobbyUpdate, games: [] };
    client.answerWith = reply;
    await expect(sendAndAwait(client, JOIN_LOBBY, messageOfType(SERVER_MESSAGE_TYPE.lobbyUpdate))).resolves.toBe(reply);
    expect(client.sent).toEqual([JSON.stringify(JOIN_LOBBY)]);
  });

  it('rejects naming the awaited message when the socket closes before the reply', async () => {
    const client = new FakeClient();
    const isAnyGameListed = (games: readonly unknown[]): boolean => games.length > 0;
    const awaited = sendAndAwait(client, JOIN_LOBBY, lobbyShows(isAnyGameListed));
    client.emit('close');
    await expect(awaited).rejects.toThrow(
      `a ${SERVER_MESSAGE_TYPE.lobbyUpdate} whose list passes isAnyGameListed from message 0 never became true`,
    );
  });
});
