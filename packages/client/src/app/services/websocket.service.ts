import { Injectable, inject, signal } from '@angular/core';
import { Subject, type Observable } from 'rxjs';
import type { ClientMessage, ServerMessage } from '@evolution/shared';
import { CLIENT_ID_QUERY_PARAMETER } from '@evolution/shared';
import { IdentityService } from './identity.service';

/**
 * Low-level WebSocket transport. Game-agnostic.
 *
 * Responsibilities:
 *  - Open/keep-alive a single WS to `/ws?clientId=...` (proxied to the server).
 *  - Auto-reconnect with a small backoff.
 *  - Queue outbound messages while disconnected and flush on (re)connect.
 *  - Expose every inbound `ServerMessage` via `messages$`, `game_snapshot` included: a snapshot
 *    is a delta (docs/ARCHITECTURE.md §4, §5), so none may be coalesced away.
 *
 * Higher-level lobby/room/game state lives in MultiplayerService.
 */
const RECONNECT_DELAY_MS = 500;

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  /** Reactive connection flag for UI binding. */
  readonly connected = signal(false);

  private socket: WebSocket | null = null;
  private readonly outbound: string[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wasClosedByUser = false;

  private readonly messages = new Subject<ServerMessage>();
  /** Stream of all decoded inbound server messages. */
  readonly messages$: Observable<ServerMessage> = this.messages.asObservable();

  private readonly identity = inject(IdentityService);

  connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.wasClosedByUser = false;
    const socket = new WebSocket(this.socketUrl());
    this.socket = socket;

    socket.onopen = () => {
      this.connected.set(true);
      // Flush anything queued while we were offline.
      for (const raw of this.outbound.splice(0)) {
        socket.send(raw);
      }
    };
    socket.onmessage = (event) => this.handleFrame(typeof event.data === 'string' ? event.data : '');
    socket.onclose = () => {
      this.connected.set(false);
      this.socket = null;
      if (!this.wasClosedByUser) {
        this.scheduleReconnect();
      }
    };
    socket.onerror = () => {
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
    this.wasClosedByUser = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    this.connected.set(false);
  }

  /** Send a typed client message (queued if currently disconnected). */
  send(message: ClientMessage): void {
    const raw = JSON.stringify(message);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(raw);
    } else {
      this.outbound.push(raw);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY_MS);
  }
}
