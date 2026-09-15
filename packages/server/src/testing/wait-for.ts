// Waits for the integration tier (docs/testing/tiers-and-builders.md §6–§7). A test on the wire waits for two kinds
// of thing: a message that has arrived, which the socket announces, and a decision the room has taken, which nothing
// announces. Neither wait carries a budget of its own, so a loaded box slows a test rather than failing it: the test
// timeout is the only bound, and a wait still open when its test ends rejects with the condition it was waiting for.
import { onTestFinished } from 'vitest';
import type { WebSocket } from 'ws';
import type { ServerMessage } from '@evolution/shared';
import { yieldToEventLoop } from './event-loop.js';

/** A socket and every message it has received, in order (`openRecordingTestSocket`). */
export interface RecordingSocket {
  readonly socket: WebSocket;
  readonly received: readonly ServerMessage[];
}

function neverBecameTrue(condition: string, reason: string): Error {
  return new Error(`${condition} never became true: ${reason}`);
}

/**
 * Resolves once `holds(received)` is true, re-checked on every message the socket receives. The recording listener
 * was attached when the socket opened, before this one, so `received` already holds the message being announced.
 */
export function untilReceived(
  recording: RecordingSocket,
  holds: (received: readonly ServerMessage[]) => boolean,
  condition: string,
): Promise<void> {
  if (holds(recording.received)) return Promise.resolve();
  const { socket } = recording;
  return new Promise((resolve, reject) => {
    let isSettled = false;
    const settle = (error?: Error): void => {
      if (isSettled) return;
      isSettled = true;
      socket.off('message', onMessage);
      socket.off('close', onClose);
      if (error) reject(error);
      else resolve();
    };
    const onMessage = (): void => {
      if (holds(recording.received)) settle();
    };
    const onClose = (): void => settle(neverBecameTrue(condition, 'the socket closed'));
    socket.on('message', onMessage);
    socket.on('close', onClose);
    onTestFinished(() => settle(neverBecameTrue(condition, 'the test ended first')));
  });
}

/**
 * Resolves once `holds()` is true, re-checked on every turn of the event loop. Only for a room decision that no
 * message announces (a `snapshot_ack` the server has read, say); anything the client is sent waits in `untilReceived`.
 */
export async function untilRoomDecides(holds: () => boolean, condition: string): Promise<void> {
  let hasTestEnded = false;
  onTestFinished(() => {
    hasTestEnded = true;
  });
  while (!holds()) {
    if (hasTestEnded) throw neverBecameTrue(condition, 'the test ended first');
    await yieldToEventLoop();
  }
}
