import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLIENT_MESSAGE_TYPE, SERVER_MESSAGE_TYPE, SOCKET_CLOSE_CODE_REPLACED } from '@evolution/shared';
import type { ServerMessage } from '@evolution/shared';
import { IdentityService } from './identity.service';
import { SOCKET_CLOSE_CAUSE, SOCKET_LIFECYCLE, WebSocketService, type SocketLifecycleEvent } from './websocket.service';
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

  it('reports every open and close, telling a dropped socket from the user’s own disconnect', () => {
    vi.useFakeTimers();
    const events: SocketLifecycleEvent[] = [];
    service.lifecycle$.subscribe((event) => events.push(event));
    service.connect();
    const first = FakeWebSocket.instances[0]!;
    first.open();
    first.close();
    vi.runAllTimers();
    FakeWebSocket.latest().open();
    service.disconnect();
    expect(events).toEqual([
      { kind: SOCKET_LIFECYCLE.opened },
      { kind: SOCKET_LIFECYCLE.closed, cause: SOCKET_CLOSE_CAUSE.dropped },
      { kind: SOCKET_LIFECYCLE.opened },
      { kind: SOCKET_LIFECYCLE.closed, cause: SOCKET_CLOSE_CAUSE.user },
    ]);
  });

  it('has already cleared the connected flag when it reports a close', () => {
    const connectedAtClose: boolean[] = [];
    service.lifecycle$.subscribe((event) => {
      if (event.kind === SOCKET_LIFECYCLE.closed) connectedAtClose.push(service.connected());
    });
    service.connect();
    FakeWebSocket.latest().open();
    FakeWebSocket.latest().close();
    expect(connectedAtClose).toEqual([false]);
    service.disconnect();
  });

  it('ignores a replaced socket’s late events: no false drop, no second reconnect, the new socket stays', () => {
    vi.useFakeTimers();
    service.connect();
    const first = FakeWebSocket.instances[0]!;
    first.open();
    service.disconnect();
    service.connect();
    const second = FakeWebSocket.latest();
    second.open();
    const events: SocketLifecycleEvent[] = [];
    const received: ServerMessage[] = [];
    service.lifecycle$.subscribe((event) => events.push(event));
    service.messages$.subscribe((message) => received.push(message));

    // A real close event is asynchronous: the old socket's arrives after the new socket opened.
    first.onclose?.({ code: FakeWebSocket.NORMAL_CLOSURE_CODE });
    first.onerror?.();
    first.receive(JSON.stringify({ type: SERVER_MESSAGE_TYPE.error, message: 'stale' }));
    vi.runAllTimers();

    expect(events).toEqual([]);
    expect(received).toEqual([]);
    expect(service.connected()).toBe(true);
    expect(FakeWebSocket.instances).toHaveLength(2);
    service.send(JOIN);
    expect(second.sent).toEqual([JSON.stringify(JOIN)]);
  });

  it('#273: stays closed when the server replaced it with another tab, and reports why', () => {
    vi.useFakeTimers();
    const events: SocketLifecycleEvent[] = [];
    service.lifecycle$.subscribe((event) => events.push(event));
    service.connect();
    FakeWebSocket.latest().open();
    FakeWebSocket.latest().close(SOCKET_CLOSE_CODE_REPLACED);
    vi.runAllTimers();
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(service.connected()).toBe(false);
    expect(events.at(-1)).toEqual({ kind: SOCKET_LIFECYCLE.closed, cause: SOCKET_CLOSE_CAUSE.replaced });
    // What is sent after the takeover is dropped, not replayed when the user connects again.
    service.send(JOIN);
    // Connecting again is the user's call, and it works.
    service.connect();
    expect(FakeWebSocket.instances).toHaveLength(2);
    FakeWebSocket.latest().open();
    expect(FakeWebSocket.latest().sent).toEqual([]);
    // After that connect, sends queue and flush as ever.
    service.disconnect();
    service.send(JOIN);
    service.connect();
    FakeWebSocket.latest().open();
    expect(FakeWebSocket.latest().sent).toEqual([JSON.stringify(JOIN)]);
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
