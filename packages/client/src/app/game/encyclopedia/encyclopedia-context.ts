// The one place a `FactContext` is made (docs/architecture/encyclopedia.md §12.2): the room's live balance while in a
// room, `DEFAULT_BALANCE` outside one, so a `debug_set_balance` patch re-renders an open page and the lobby reads
// the shipped numbers. Components read the service's signal; nothing else constructs a context.

import { Injectable, computed, inject, type Signal } from '@angular/core';
import { DEFAULT_BALANCE, type BalanceConfig } from '@evolution/shared';
import { GameStateService } from '../state/game-state.service';
import type { FactContext } from './model/fact';

/** Pure: the room's balance, else the shipped one. */
export function factContextFor(balance: BalanceConfig | null): FactContext {
  return { balance: balance ?? DEFAULT_BALANCE };
}

@Injectable({ providedIn: 'root' })
export class EncyclopediaContextService {
  private readonly gameState = inject(GameStateService);

  readonly context: Signal<FactContext> = computed(() => factContextFor(this.gameState.balance()));
}
