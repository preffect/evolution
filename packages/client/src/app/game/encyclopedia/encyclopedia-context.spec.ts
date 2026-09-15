// docs/architecture/encyclopedia.md §12.6: the one context provider. Outside a room the shipped balance, inside one
// the room's, and the service's signal follows `GameStateService.balance` as a patch arrives.

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, type BalanceConfig } from '@evolution/shared';
import { GameStateService } from '../state/game-state.service';
import { EncyclopediaContextService, factContextFor } from './encyclopedia-context';

function roomBalance(): BalanceConfig {
  return structuredClone(DEFAULT_BALANCE) as BalanceConfig;
}

describe('factContextFor', () => {
  it('reads DEFAULT_BALANCE outside a room', () => {
    expect(factContextFor(null).balance).toBe(DEFAULT_BALANCE);
  });

  it('reads the room’s balance when there is one', () => {
    const balance = roomBalance();
    expect(factContextFor(balance).balance).toBe(balance);
  });
});

describe('EncyclopediaContextService', () => {
  it('follows GameStateService.balance: the default, the room’s, a patch, and the default again', () => {
    const balance = signal<BalanceConfig | null>(null);
    TestBed.configureTestingModule({ providers: [{ provide: GameStateService, useValue: { balance } }] });
    const service = TestBed.inject(EncyclopediaContextService);
    expect(service.context().balance).toBe(DEFAULT_BALANCE);

    const joined = roomBalance();
    balance.set(joined);
    expect(service.context().balance).toBe(joined);

    const patched = roomBalance();
    balance.set(patched);
    expect(service.context().balance).toBe(patched);

    balance.set(null);
    expect(service.context().balance).toBe(DEFAULT_BALANCE);
  });
});
