// Waits for the integration tier (docs/testing/tiers-and-builders.md §6–§7). A test on the wire waits for two kinds
// of thing: a message that has arrived, which the socket announces, and a decision the room has taken, which nothing
// announces. Neither wait carries a budget of its own, so a loaded box slows a test rather than failing it: the test
// timeout is the only bound, and a wait still open when its test ends fails that test with the condition it was
// waiting for.
import { onTestFinished } from 'vitest';
import { WebSocket } from 'ws';
import type { ServerMessage } from '@evolution/shared';
import { yieldToEventLoop } from './event-loop.js';

/** A socket and every message it has received, in order (`openRecordingTestSocket`). */
export interface RecordingSocket {
  readonly socket: WebSocket;
  readonly received: readonly ServerMessage[];
}

const SOCKET_CLOSED = 'the socket closed';

function neverBecameTrue(condition: string, reason: string): Error {
  return new Error(`${condition} never became true: ${reason}`);
}

/**
 * When the current test ends with the wait still open, `abandon` stops the wait and the error is thrown from the test's
 * own `onTestFinished` hook, which vitest records against the test. A rejection alone would name the condition to no
 * one: a test that timed out has already been reported, and its promise is dropped.
 */
function failTestIfStillOpen(condition: string, isOpen: () => boolean, abandon: (error: Error) => void): void {
  onTestFinished(() => {
    if (!isOpen()) return;
    const error = neverBecameTrue(condition, 'the test ended first');
    abandon(error);
    throw error;
  });
}

/**
 * Resolves once `holds(received)` is true, re-checked on every message the socket receives. The recording listener
 * was attached when the socket opened, before this one, so `received` already holds the message being announced.
 * A socket already closed when the wait starts can receive nothing more, so the wait rejects at once.
 */
export function untilReceived(
  recording: RecordingSocket,
  holds: (received: readonly ServerMessage[]) => boolean,
  condition: string,
): Promise<void> {
  if (holds(recording.received)) return Promise.resolve();
  const { socket } = recording;
  if (socket.readyState === WebSocket.CLOSED) return Promise.reject(neverBecameTrue(condition, SOCKET_CLOSED));
  return new Promise((resolve, reject) => {
    let isSettled = false;
    const settle = (error?: unknown): void => {
      if (isSettled) return;
      isSettled = true;
      socket.off('message', onMessage);
      socket.off('close', onClose);
      if (error === undefined) resolve();
      else reject(error);
    };
    const onMessage = (): void => {
      try {
        if (holds(recording.received)) settle();
      } catch (error) {
        settle(error);
      }
    };
    const onClose = (): void => settle(neverBecameTrue(condition, SOCKET_CLOSED));
    socket.on('message', onMessage);
    socket.on('close', onClose);
    failTestIfStillOpen(condition, () => !isSettled, settle);
  });
}

/**
 * Resolves once `holds()` is true, re-checked on every turn of the event loop without idling, so it keeps one core
 * busy for as long as it waits: only for a room decision that no message announces and that follows within a few
 * turns (a `snapshot_ack` the server has read, say). Anything the client is sent waits in `untilReceived`.
 */
export async function untilRoomDecides(holds: () => boolean, condition: string): Promise<void> {
  let isOpen = true;
  let abandonment: Error | undefined;
  failTestIfStillOpen(
    condition,
    () => isOpen,
    (error) => {
      abandonment = error;
    },
  );
  try {
    while (!holds()) {
      if (abandonment) throw abandonment;
      await yieldToEventLoop();
    }
  } finally {
    isOpen = false;
  }
}
