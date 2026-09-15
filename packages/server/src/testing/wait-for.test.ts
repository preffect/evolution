import { EventEmitter } from 'node:events';
import { describe, expect, it, onTestFinished } from 'vitest';
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

/**
 * Checks what the current test reports when it ends. Registered before the wait, this hook runs after the wait's own
 * (vitest runs `onTestFinished` hooks last-registered first), reads the errors recorded against the test, and clears
 * them so that the test's verdict is this check alone.
 */
function expectTestToReport(expectedMessages: string[]): void {
  onTestFinished(({ task }) => {
    const result = task.result!;
    const reportedMessages = (result.errors ?? []).map((error) => error.message);
    result.errors = [];
    result.state = 'pass';
    expect(reportedMessages).toEqual(expectedMessages);
  });
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

  it('rejects with the error a condition throws, and stops listening', async () => {
    const { recording, emitter, received } = fakeRecording();
    const unexpectedFrame = new Error('not a snapshot');
    const waiting = untilReceived(
      recording,
      (messages) => {
        if (messages.length > 0) throw unexpectedFrame;
        return false;
      },
      'a snapshot',
    );
    receive(emitter, received, LOBBY_UPDATE);
    await expect(waiting).rejects.toBe(unexpectedFrame);
    expect(emitter.listenerCount('message')).toBe(0);
    expect(emitter.listenerCount('close')).toBe(0);
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

describe('a wait still open when its test ends', () => {
  it('fails the test with the condition a message wait was waiting for', () => {
    expectTestToReport(['a lobby update never became true: the test ended first']);
    const { recording } = fakeRecording();
    void untilReceived(recording, () => false, 'a lobby update').catch(() => undefined);
  });

  it('fails the test with the condition a room wait was waiting for', () => {
    expectTestToReport(['the room seated bob never became true: the test ended first']);
    void untilRoomDecides(() => false, 'the room seated bob').catch(() => undefined);
  });

  it('adds nothing to a test whose waits all settled', async () => {
    expectTestToReport([]);
    const { recording, received } = fakeRecording();
    received.push(LOBBY_UPDATE);
    await untilReceived(recording, (messages) => messages.length > 0, 'a lobby update');
    await untilRoomDecides(() => true, 'the room decided');
  });
});
