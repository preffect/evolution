// Test double (docs/testing/tiers-and-builders.md §4): the `WebSocketService` surface `MultiplayerService` reads,
// with the inbound message and socket lifecycle streams driven from outside. Provide it with
// `{ provide: WebSocketService, useValue: createTransportStub() }`.
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import type { ServerMessage } from '@evolution/shared';
import type { SocketLifecycleEvent } from '../app/services/websocket.service';

export function createTransportStub() {
  const messages = new Subject<ServerMessage>();
  const lifecycle = new Subject<SocketLifecycleEvent>();
  return {
    messages,
    lifecycle,
    connected: signal(false),
    messages$: messages.asObservable(),
    lifecycle$: lifecycle.asObservable(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
  };
}

export type TransportStub = ReturnType<typeof createTransportStub>;
