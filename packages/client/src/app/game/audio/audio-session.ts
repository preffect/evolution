// The audio session of one room (docs/architecture/client.md §7, #275): which `AudioHooksHandle` is live, and when a
// `game_state` needs a new one. A resync (#266, #300) is routine flow control, not a new session, so it must not tear
// the sounds down: the same player in a room with the same round length keeps its loops and its transition memory and
// only takes the new balance, as `RenderSession.buildRendererFor` keeps the Pixi app for the same seed. A different
// player or round length (a reconnect into another room) starts over. Framework-free; `RenderSession` owns one.

import type { AudioHooksHandle } from './audio-hooks';
import type { TransitionOptions } from '../state/snapshot-transitions';

/** What identifies a session: the balance is not in it, since `balance_updated` patches a live session too. */
function isSameSession(current: TransitionOptions, next: TransitionOptions): boolean {
  return current.ownPlayerId === next.ownPlayerId && current.roundDurationSeconds === next.roundDurationSeconds;
}

export class AudioSession {
  private handle: AudioHooksHandle | null = null;
  private options: TransitionOptions | null = null;

  constructor(private readonly connect: (options: TransitionOptions) => AudioHooksHandle) {}

  /** A `game_state`: keeps the live session when it is the same one, else disconnects it and connects anew. */
  begin(options: TransitionOptions): void {
    if (this.handle !== null && this.options !== null && isSameSession(this.options, options)) {
      this.handle.updateOptions({ balance: options.balance });
      this.options = options;
      return;
    }
    this.handle?.disconnect();
    this.handle = this.connect(options);
    this.options = options;
  }

  observe(...args: Parameters<AudioHooksHandle['observe']>): void {
    this.handle?.observe(...args);
  }

  updateOptions(patch: Partial<TransitionOptions>): void {
    this.handle?.updateOptions(patch);
    if (this.options !== null) this.options = { ...this.options, ...patch };
  }

  unlock(): void {
    this.handle?.unlock();
  }

  disconnect(): void {
    this.handle?.disconnect();
    this.handle = null;
    this.options = null;
  }
}
