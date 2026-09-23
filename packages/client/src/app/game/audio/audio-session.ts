// The audio session of one room (docs/architecture/client.md §7, #275): which `AudioHooksHandle` is live, and when a
// `game_state` needs a new one. A resync (#266, #300) is routine flow control, not a new session, so it must not tear
// the sounds down: the same player in the same room keeps its loops and its transition memory and only takes the new
// balance, as `RenderSession.buildRendererFor` keeps the Pixi app for the same seed. Another room or another player
// starts over. A player's id is stable across rooms (the stored client id), so the room is what tells two sessions
// apart. Framework-free; `RenderSession` owns one.

import type { GameId, PlayerId } from '@evolution/shared';
import type { AudioHooksHandle } from './audio-hooks';
import type { TransitionOptions } from '../state/snapshot-transitions';

/** What names a session: the room and the player in it. Round length cannot change inside a room, so it is not in it. */
export interface AudioSessionKey {
  readonly gameId: GameId;
  readonly ownPlayerId: PlayerId;
}

function isSameSession(current: AudioSessionKey, next: AudioSessionKey): boolean {
  return current.gameId === next.gameId && current.ownPlayerId === next.ownPlayerId;
}

export class AudioSession {
  private handle: AudioHooksHandle | null = null;
  private key: AudioSessionKey | null = null;

  constructor(private readonly connect: (options: TransitionOptions) => AudioHooksHandle) {}

  /** A `game_state`: keeps the live session when it is the same one, else disconnects it and connects anew. */
  begin(gameId: GameId, options: TransitionOptions): void {
    const key: AudioSessionKey = { gameId, ownPlayerId: options.ownPlayerId };
    if (this.handle !== null && this.key !== null && isSameSession(this.key, key)) {
      this.handle.updateOptions({ balance: options.balance });
      return;
    }
    this.handle?.disconnect();
    this.handle = this.connect(options);
    this.key = key;
  }

  observe(...args: Parameters<AudioHooksHandle['observe']>): void {
    this.handle?.observe(...args);
  }

  updateOptions(patch: Partial<TransitionOptions>): void {
    this.handle?.updateOptions(patch);
  }

  unlock(): void {
    this.handle?.unlock();
  }

  disconnect(): void {
    this.handle?.disconnect();
    this.handle = null;
    this.key = null;
  }
}
