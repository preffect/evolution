// The toasts' one owner (docs/ui/overlays.md §3.6): it folds every snapshot into the pure step (`format/toasts.ts`)
// and answers which toast is up. `toast.component.ts` binds it. The memory is kept per seat (room and player), so a
// reconnect inside the grace, which keeps the snapshot, neither replays `late_join` nor misses a change. Leaving the
// room clears the snapshot and with it the memory: a rejoin, even to the same seat, starts over.

import { Injectable, computed, effect, inject, linkedSignal } from '@angular/core';
import type { GameSnapshot } from '@evolution/shared';
import { INITIAL_TOAST_MEMORY, toastStepFor, type Toast, type ToastMemory } from './format/toasts';
import { GameStateService } from '../state/game-state.service';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly gameState = inject(GameStateService);

  /** Carried from snapshot to snapshot; a recomputation on the same snapshot changes nothing. */
  private readonly memory = linkedSignal<GameSnapshot | null, ToastMemory>({
    source: () => this.gameState.snapshot(),
    computation: (snapshot, previous) => {
      const last = previous?.value ?? INITIAL_TOAST_MEMORY;
      if (snapshot === null) return INITIAL_TOAST_MEMORY;
      return toastStepFor(last, {
        seatKey: `${this.gameState.gameId() ?? ''}/${this.gameState.ownPlayerId() ?? ''}`,
        tick: snapshot.tick,
        ownProgress: this.gameState.ownProgress(),
      });
    },
  });

  /** The toast on screen, or `null`. */
  readonly current = computed<Toast | null>(() => this.memory().toast);

  constructor() {
    // The memory steps only when read; this read steps it once per change detection, so no snapshot's change is
    // skipped while no toast is up to be read.
    effect(() => this.memory());
  }
}
