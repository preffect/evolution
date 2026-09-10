// The wire as a bot sees it: typed frames in and out, nothing else. The session speaks only
// this seam, so the unit tests drive it with a fake and the integration test and the CLI with
// the `ws` transport (`web-socket-transport.ts`).

import type { ClientMessage, ServerMessage } from '@evolution/shared';

export interface BotTransport {
  send(message: ClientMessage): void;
  onMessage(listener: (message: ServerMessage) => void): void;
  onClose(listener: () => void): void;
  close(): void;
}

/** Opens a transport to a `/ws` URL; rejects with `BotClientError` when the socket cannot open. */
export type BotTransportFactory = (url: string) => Promise<BotTransport>;
