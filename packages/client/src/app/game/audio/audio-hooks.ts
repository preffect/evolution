// The one call the composition root makes to hear the game (docs/ARCHITECTURE.md §7,
// docs/AUDIO.md §5): `connect` builds the snapshot tracker and the sound bus over the shared
// `GameEventBus` and starts loading the manifest; the handle it returns is what `game-setup.ts`
// (#99) feeds snapshots and the unlock gesture to, and tears down with the room.

import { Injectable, inject } from '@angular/core';
import type { GameSnapshot } from '@evolution/shared';
import { AudioService } from './audio.service';
import { SoundEventBus } from './sound-event-bus';
import { GameEventBus } from '../state/game-event-bus';
import { SnapshotTransitionTracker, type TransitionOptions } from '../state/snapshot-transitions';

/** A connected audio wire; every method is safe to call after `disconnect` (a no-op). */
export interface AudioHooksHandle {
  /** Resolves when the manifest and its files are loaded (or found missing: silence). */
  readonly ready: Promise<void>;
  /** Every rendered snapshot, in order; the tracker turns it into game events. */
  observe(snapshot: GameSnapshot): void;
  /** `balance_updated` and a rematch change the numbers the tracker reads. */
  updateOptions(patch: Partial<TransitionOptions>): void;
  /** From the first pointer event: browsers keep audio suspended until a gesture. */
  unlock(): void;
  /** Stops every sound, forgets the round and leaves the event bus. */
  disconnect(): void;
}

@Injectable({ providedIn: 'root' })
export class AudioHooks {
  private readonly audio = inject(AudioService);
  private readonly events = inject(GameEventBus);

  connect(options: TransitionOptions): AudioHooksHandle {
    const tracker = new SnapshotTransitionTracker(this.events, options);
    let unsubscribe: (() => void) | null = new SoundEventBus(this.events, this.audio).connect();
    const isConnected = (): boolean => unsubscribe !== null;
    return {
      ready: this.audio.initialize(),
      observe: (snapshot) => {
        if (isConnected()) tracker.observe(snapshot);
      },
      updateOptions: (patch) => tracker.updateOptions(patch),
      unlock: () => this.audio.unlock(),
      disconnect: () => {
        if (!isConnected()) return;
        unsubscribe?.();
        unsubscribe = null;
        tracker.reset();
        this.audio.stopAll();
      },
    };
  }
}
