import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLIENT_MESSAGE_TYPE, SERVER_MESSAGE_TYPE } from '@evolution/shared';
import type { ServerMessage } from '@evolution/shared';
import { IdentityService } from './identity.service';
import { WebSocketService } from './websocket.service';
import { FakeWebSocket } from '../../testing/fake-websocket';

const JOIN = { type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: 'A', avatarIndex: 0 } as const;

describe('WebSocketService', () => {
  let service: WebSocketService;

  beforeEach(() => {
    FakeWebSocket.reset();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    TestBed.configureTestingModule({ providers: [{ provide: IdentityService, useValue: { clientId: 'me' } }] });
    service = TestBed.inject(WebSocketService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('opens one socket carrying the client id and ignores a second connect while it is live', () => {
    service.connect();
    service.connect();
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0]!.url).toContain('/ws?clientId=me');
  });

  it('queues messages while offline and flushes them once open', () => {
    service.send(JOIN);
    service.connect();
    const socket = FakeWebSocket.instances[0]!;
    expect(socket.sent).toEqual([]);
    socket.open();
    expect(service.connected()).toBe(true);
    expect(socket.sent).toEqual([JSON.stringify(JOIN)]);
    service.send(JOIN);
    expect(socket.sent).toHaveLength(2);
  });

  it('publishes every decoded message in arrival order, snapshots included, and drops malformed frames', () => {
    const received: ServerMessage[] = [];
    service.messages$.subscribe((message) => received.push(message));
    service.connect();
    const socket = FakeWebSocket.instances[0]!;
    socket.open();
    socket.receive(JSON.stringify({ type: SERVER_MESSAGE_TYPE.error, message: 'x' }));
    socket.receive(JSON.stringify({ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: 1 }));
    socket.receive(JSON.stringify({ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: 2 }));
    socket.receive('{"type":"game_snapshot" broken');
    socket.receive('broken');
    socket.receive(new Blob());
    expect(received).toEqual([
      { type: SERVER_MESSAGE_TYPE.error, message: 'x' },
      { type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: 1 },
      { type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: 2 },
    ]);
  });

  it('reconnects after an unexpected close but not after a user disconnect', () => {
    vi.useFakeTimers();
    service.connect();
    const first = FakeWebSocket.instances[0]!;
    first.open();
    first.onerror?.();
    expect(service.connected()).toBe(false);
    vi.runAllTimers();
    expect(FakeWebSocket.instances).toHaveLength(2);
    service.disconnect();
    vi.runAllTimers();
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('disconnect cancels a pending reconnect', () => {
    vi.useFakeTimers();
    service.connect();
    FakeWebSocket.instances[0]!.close();
    service.disconnect();
    vi.runAllTimers();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
