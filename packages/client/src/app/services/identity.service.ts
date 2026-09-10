import { Injectable } from '@angular/core';
import { CLIENT_ID_STORAGE_KEY } from '@evolution/shared';

/**
 * Stable per-browser client identity. The clientId is persisted in
 * localStorage and sent on the WS handshake (`/ws?clientId=...`) so the server
 * can recognise a reconnecting / multi-tab player and hand them back their
 * existing seat (takeover / reattach) instead of treating them as brand new.
 *
 * Game-agnostic: nothing here is specific to any particular game.
 */

/** Fallback id shape when `crypto.randomUUID` is unavailable: `c_<time base36>_<8 random base36 chars>`. */
const BASE36_RADIX = 36;
const RANDOM_SUFFIX_START = 2;
const RANDOM_SUFFIX_END = 10;

@Injectable({ providedIn: 'root' })
export class IdentityService {
  readonly clientId: string;

  constructor() {
    let id = this.read();
    if (!id) {
      id = this.generate();
      this.write(id);
    }
    this.clientId = id;
  }

  private read(): string | null {
    try {
      return localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private write(id: string): void {
    try {
      localStorage.setItem(CLIENT_ID_STORAGE_KEY, id);
    } catch {
      /* localStorage unavailable (private mode, etc.) — ephemeral id is fine. */
    }
  }

  private generate(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    const timePart = Date.now().toString(BASE36_RADIX);
    const randomPart = Math.random().toString(BASE36_RADIX).slice(RANDOM_SUFFIX_START, RANDOM_SUFFIX_END);
    return `c_${timePart}_${randomPart}`;
  }
}
