import { Injectable, inject, signal } from '@angular/core';
import { Subject, type Observable } from 'rxjs';
import type { ClientMessage, ServerMessage } from '@evolution/shared';
import { SERVER_MESSAGE_TYPE } from '@evolution/shared';
import { IdentityService } from './identity.service';

/** JSON prefix of a `game_snapshot` frame, matched before parsing on the hot path. */
const SNAPSHOT_FRAME_PREFIX = `{"type":"${SERVER_MESSAGE_TYPE.gameSnapshot}"`;

/**
 * Low-level WebSocket transport. Game-agnostic.
 *
 * Responsibilities:
 *  - Open/keep-alive a single WS to `/ws?clientId=...` (proxied to the server).
 *  - Auto-reconnect with a small backoff.
 *  - Queue outbound messages while disconnected and flush on (re)connect.
 *  - Expose every inbound `ServerMessage` via `messages$`.
 *  - Provide a `drainLatestSnapshot()` fast-path that coalesces high-frequency
 *    `game_snapshot` frames so a render loop only ever consumes the newest one.
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

  /**
   * Coalescing fast-path: the most recent `game_snapshot` message that has not
   * yet been drained. A render loop calls `drainLatestSnapshot()` once per
   * frame and renders only the freshest world state, dropping intermediate
   * frames that arrived faster than it can render.
   */
  private latestSnapshot: ServerMessage | null = null;

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
    return `${protocol}://${location.host}/ws?clientId=${encodeURIComponent(this.identity.clientId)}`;
  }

  /**
   * Fast-path: coalesce snapshot frames without JSON-parsing on the hot path
   * unless we actually need the object; everything else is decoded and published.
   */
  private handleFrame(raw: string): void {
    if (!raw) return;
    if (raw.startsWith(SNAPSHOT_FRAME_PREFIX)) {
      try {
        this.latestSnapshot = JSON.parse(raw) as ServerMessage;
      } catch {
        /* ignore malformed frame */
      }
      return;
    }
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

  /**
   * Return the freshest un-rendered `game_snapshot` message, or null if none
   * has arrived since the last drain. Intended to be called once per render
   * frame so the UI always renders the latest world state.
   */
  drainLatestSnapshot(): ServerMessage | null {
    const snapshot = this.latestSnapshot;
    this.latestSnapshot = null;
    return snapshot;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY_MS);
  }
}
