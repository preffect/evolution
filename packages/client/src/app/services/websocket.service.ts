import { Injectable, inject, signal } from '@angular/core';
import { Subject, type Observable } from 'rxjs';
import type { ClientMessage, ServerMessage, ValueOf } from '@evolution/shared';
import { CLIENT_ID_QUERY_PARAMETER, SOCKET_CLOSE_CODE_REPLACED } from '@evolution/shared';
import { IdentityService } from './identity.service';

/**
 * Low-level WebSocket transport. Game-agnostic.
 *
 * Responsibilities:
 *  - Open/keep-alive a single WS to `/ws?clientId=...` (proxied to the server).
 *  - Auto-reconnect with a small backoff.
 *  - Queue outbound messages while disconnected and flush on (re)connect.
 *  - Expose every inbound `ServerMessage` via `messages$`, `game_snapshot` included: a snapshot
 *    is a delta (docs/architecture/wire-contract.md §4, docs/architecture/client.md §5), so none may be coalesced away.
 *  - Report every open and close via `lifecycle$`, so the room layer can tell a dropped socket
 *    from the user's own disconnect (docs/ui/overlays.md §3.6).
 *
 * Higher-level lobby/room/game state lives in MultiplayerService.
 */
/** How long after an unexpected close the transport opens a new socket. */
export const RECONNECT_DELAY_MS = 500;

export const SOCKET_LIFECYCLE = {
  opened: 'opened',
  closed: 'closed',
} as const;

/** Why a socket closed, which decides whether a reconnect follows. */
export const SOCKET_CLOSE_CAUSE = {
  /** `disconnect()` closed it: no reconnect. */
  user: 'user',
  /** It dropped on its own: a reconnect follows after `RECONNECT_DELAY_MS`. */
  dropped: 'dropped',
  /**
   * The server closed it with `SOCKET_CLOSE_CODE_REPLACED`: another tab with this clientId took the seat. No reconnect,
   * or the two tabs would take it from each other forever (#273); connecting again is the user's call.
   */
  replaced: 'replaced',
} as const;

export type SocketCloseCause = ValueOf<typeof SOCKET_CLOSE_CAUSE>;

export type SocketLifecycleEvent =
  | { readonly kind: typeof SOCKET_LIFECYCLE.opened }
  | { readonly kind: typeof SOCKET_LIFECYCLE.closed; readonly cause: SocketCloseCause };

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  /** Reactive connection flag for UI binding. */
  readonly connected = signal(false);

  private socket: WebSocket | null = null;
  private readonly outbound: string[] = [];
  /**
   * Set by a takeover close (#273): what this tab queues now is for a seat it no longer holds, so it is dropped rather
   * than replayed at the socket the user's next `connect()` opens. That connect clears it.
   */
  private isReplaced = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly messages = new Subject<ServerMessage>();
  /** Stream of all decoded inbound server messages. */
  readonly messages$: Observable<ServerMessage> = this.messages.asObservable();

  private readonly lifecycle = new Subject<SocketLifecycleEvent>();
  /** Every open and close, in order, after `connected` has been updated for it. */
  readonly lifecycle$: Observable<SocketLifecycleEvent> = this.lifecycle.asObservable();

  private readonly identity = inject(IdentityService);

  connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.isReplaced = false;
    const socket = new WebSocket(this.socketUrl());
    this.socket = socket;

    // Every handler belongs to this one socket. Its events arrive asynchronously, so once `disconnect()`
    // or a reconnect has replaced it, a late one must not touch the new socket or report a false drop.
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.connected.set(true);
      // Flush anything queued while we were offline.
      for (const raw of this.outbound.splice(0)) {
        socket.send(raw);
      }
      this.lifecycle.next({ kind: SOCKET_LIFECYCLE.opened });
    };
    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      this.handleFrame(typeof event.data === 'string' ? event.data : '');
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.connected.set(false);
      this.socket = null;
      // `disconnect()` detaches its socket before closing it, so a close that reaches here is a drop or a takeover.
      const cause =
        event.code === SOCKET_CLOSE_CODE_REPLACED ? SOCKET_CLOSE_CAUSE.replaced : SOCKET_CLOSE_CAUSE.dropped;
      if (cause === SOCKET_CLOSE_CAUSE.dropped) this.scheduleReconnect();
      else this.dropOutboundUntilConnect();
      this.lifecycle.next({ kind: SOCKET_LIFECYCLE.closed, cause });
    };
    socket.onerror = () => {
      if (this.socket !== socket) return;
      // Let onclose drive reconnection.
      socket.close();
    };
  }

  private socketUrl(): string {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${location.host}/ws?${CLIENT_ID_QUERY_PARAMETER}=${encodeURIComponent(this.identity.clientId)}`;
  }

  /** Every frame is decoded and published in arrival order; a malformed one is dropped. */
  private handleFrame(raw: string): void {
    if (!raw) return;
    let message: ServerMessage;
    try {
      message = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }
    this.messages.next(message);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const socket = this.socket;
    // Detached first, so the socket's own close event is a stale one and changes nothing.
    this.socket = null;
    socket?.close();
    this.connected.set(false);
    if (socket !== null) this.lifecycle.next({ kind: SOCKET_LIFECYCLE.closed, cause: SOCKET_CLOSE_CAUSE.user });
  }

  /** Send a typed client message (queued if currently disconnected). */
  send(message: ClientMessage): void {
    const raw = JSON.stringify(message);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(raw);
    } else if (!this.isReplaced) {
      this.outbound.push(raw);
    }
  }

  private dropOutboundUntilConnect(): void {
    this.isReplaced = true;
    this.outbound.length = 0;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY_MS);
  }
}
