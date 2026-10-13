// The upgrade popups' one owner (docs/ui/overlays.md §3.8, #783): it folds every snapshot into the pure step
// (`format/upgrade-popups.ts`) and answers which popup is up. `upgrade-popup.component.ts` binds it. The memory is
// kept per seat (room and player), as the toasts' is (`toast.service.ts`): a reconnect inside the grace keeps it, and
// leaving the room clears the snapshot and the memory with it. A trait gained is a change, which the newest snapshot
// still shows when two land before one fold; a giant swallowed is an event, which it would not, so the swallows come
// from the `GameEventBus` (docs/architecture/client.md §6), which hears every snapshot, and wait here to be folded.

import { DestroyRef, Injectable, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import type { GameSnapshot } from '@evolution/shared';
import { giantSwallowOf, giantSwallowsKeptAt, withGiantSwallow, type GiantSwallow } from './format/giant-popups';
import {
  INITIAL_UPGRADE_POPUP_MEMORY,
  upgradePopupStepFor,
  upgradePopupUpAt,
  type UpgradePopupMemory,
} from './format/upgrade-popups';
import type { UpgradePopup } from './format/upgrade-popup-kinds';
import { GAME_EVENT_KIND, GameEventBus, type GameEvent } from '../state/game-event-bus';
import { GameStateService } from '../state/game-state.service';

@Injectable({ providedIn: 'root' })
export class UpgradePopupService {
  private readonly gameState = inject(GameStateService);

  /** The room and player a memory belongs to. */
  private readonly seatKey = computed(() => `${this.gameState.gameId() ?? ''}/${this.gameState.ownPlayerId() ?? ''}`);

  /** The giants the own cell swallowed, in the order the bus reported them, until past or the memory starts over. */
  private readonly giantSwallows = signal<readonly GiantSwallow[]>([]);

  /** Carried from snapshot to snapshot; a recomputation on the same snapshot changes nothing. */
  private readonly memory = linkedSignal<GameSnapshot | null, UpgradePopupMemory>({
    source: () => this.gameState.snapshot(),
    computation: (snapshot, previous) => {
      const last = previous?.value ?? INITIAL_UPGRADE_POPUP_MEMORY;
      if (snapshot === null) return INITIAL_UPGRADE_POPUP_MEMORY;
      return upgradePopupStepFor(last, {
        seatKey: this.seatKey(),
        tick: snapshot.tick,
        ownProgress: this.gameState.ownProgress(),
        traits: this.gameState.balance()?.traits ?? null,
        giantSwallows: this.giantSwallows(),
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
    // while no popup is up to be read. A fold that started the memory over (a new seat, the clock gone back) lets go of
    // the swallows it can no longer fire once, or a swallow after the rewound tick would fire again when the clock
    // came back to it (#842). Safe because the memory is only read inside change detection, where this effect runs
    // before the popup's template; a read outside it could see the swallows before the prune. `giantSwallowsKeptAt`
    // returns the same array when nothing leaves, or this write would wake the effect again for ever.
    effect(() => {
      const memory = this.memory();
      this.giantSwallows.update((kept) => giantSwallowsKeptAt(kept, memory));
    });
    const unsubscribe = inject(GameEventBus).subscribe((event) => this.recordGiantSwallow(event));
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  private recordGiantSwallow(event: GameEvent): void {
    if (event.kind !== GAME_EVENT_KIND.effect) return;
    const swallow = giantSwallowOf(event.effect, event.isOwnPredator, this.seatKey());
    if (swallow !== null) this.giantSwallows.update((kept) => withGiantSwallow(kept, swallow));
  }
}
