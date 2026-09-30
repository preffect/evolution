// The upgrade popups' one owner (docs/ui/overlays.md §3.8, #783): it folds every snapshot into the pure step
// (`format/upgrade-popups.ts`) and answers which popup is up. `upgrade-popup.component.ts` binds it. The memory is
// kept per seat (room and player), as the toasts' is (`toast.service.ts`): a reconnect inside the grace keeps it, and
// leaving the room clears the snapshot and the memory with it.

import { Injectable, computed, effect, inject, linkedSignal } from '@angular/core';
import type { GameSnapshot } from '@evolution/shared';
import {
  INITIAL_UPGRADE_POPUP_MEMORY,
  upgradePopupStepFor,
  upgradePopupUpAt,
  type UpgradePopup,
  type UpgradePopupMemory,
} from './format/upgrade-popups';
import { GameStateService } from '../state/game-state.service';

@Injectable({ providedIn: 'root' })
export class UpgradePopupService {
  private readonly gameState = inject(GameStateService);

  /** Carried from snapshot to snapshot; a recomputation on the same snapshot changes nothing. */
  private readonly memory = linkedSignal<GameSnapshot | null, UpgradePopupMemory>({
    source: () => this.gameState.snapshot(),
    computation: (snapshot, previous) => {
      const last = previous?.value ?? INITIAL_UPGRADE_POPUP_MEMORY;
      if (snapshot === null) return INITIAL_UPGRADE_POPUP_MEMORY;
      return upgradePopupStepFor(last, {
        seatKey: `${this.gameState.gameId() ?? ''}/${this.gameState.ownPlayerId() ?? ''}`,
        tick: snapshot.tick,
        ownProgress: this.gameState.ownProgress(),
        traits: this.gameState.balance()?.traits ?? null,
      });
    },
  });

  /** The popup on screen, or `null`. */
  readonly current = computed<UpgradePopup | null>(() => {
    const memory = this.memory();
    return memory.tick === null ? null : upgradePopupUpAt(memory, memory.tick);
  });

  constructor() {
    // The memory steps only when read; this read steps it once per change detection, so no snapshot's gain is missed
    // while no popup is up to be read.
    effect(() => this.memory());
  }
}
