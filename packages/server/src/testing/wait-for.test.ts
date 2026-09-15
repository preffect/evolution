import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import { SERVER_MESSAGE_TYPE, type ServerMessage } from '@evolution/shared';
import { untilReceived, untilRoomDecides, type RecordingSocket } from './wait-for.js';

const LOBBY_UPDATE: ServerMessage = { type: SERVER_MESSAGE_TYPE.lobbyUpdate, games: [] };

/** A socket stand-in: the waits only listen for `message` and `close`. */
function fakeRecording(): { recording: RecordingSocket; emitter: EventEmitter; received: ServerMessage[] } {
  const emitter = new EventEmitter();
  const received: ServerMessage[] = [];
  return { recording: { socket: emitter as unknown as WebSocket, received }, emitter, received };
}

function receive(emitter: EventEmitter, received: ServerMessage[], message: ServerMessage): void {
  received.push(message);
  emitter.emit('message');
}

describe('untilReceived', () => {
  it('resolves at once when the message is already recorded', async () => {
    const { recording, received } = fakeRecording();
    received.push(LOBBY_UPDATE);
    await expect(
      untilReceived(recording, (messages) => messages.length > 0, 'a lobby update'),
    ).resolves.toBeUndefined();
  });

  it('resolves on the message that makes the condition hold, and stops listening', async () => {
    const { recording, emitter, received } = fakeRecording();
    const waiting = untilReceived(recording, (messages) => messages.length === 2, 'two lobby updates');
    receive(emitter, received, LOBBY_UPDATE);
    expect(emitter.listenerCount('message')).toBe(1);
    receive(emitter, received, LOBBY_UPDATE);
    await expect(waiting).resolves.toBeUndefined();
    expect(emitter.listenerCount('message')).toBe(0);
    expect(emitter.listenerCount('close')).toBe(0);
  });

  it('rejects naming the condition when the socket closes first', async () => {
    const { recording, emitter } = fakeRecording();
    const waiting = untilReceived(recording, () => false, 'a lobby update');
    emitter.emit('close');
    await expect(waiting).rejects.toThrow('a lobby update never became true: the socket closed');
  });
});

describe('a wait still open when its test ends', () => {
  let abandonedMessageWait: Promise<unknown> = Promise.resolve();
  let abandonedRoomWait: Promise<unknown> = Promise.resolve();

  it('is left open by a test that ends without it', () => {
    const { recording } = fakeRecording();
    abandonedMessageWait = untilReceived(recording, () => false, 'a lobby update').catch((error: unknown) => error);
    abandonedRoomWait = untilRoomDecides(() => false, 'the room seated bob').catch((error: unknown) => error);
  });

  it('rejects naming the condition it was waiting for', async () => {
    expect(await abandonedMessageWait).toEqual(new Error('a lobby update never became true: the test ended first'));
    expect(await abandonedRoomWait).toEqual(new Error('the room seated bob never became true: the test ended first'));
  });
});

describe('untilRoomDecides', () => {
  it('resolves on the turn of the event loop where the decision holds', async () => {
    let turns = 0;
    await untilRoomDecides(() => {
      turns += 1;
      return turns === 3;
    }, 'the third turn');
    expect(turns).toBe(3);
  });
});
