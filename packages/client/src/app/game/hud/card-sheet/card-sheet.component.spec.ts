import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '@evolution/shared';
import { HUD_TEST_ID } from '../../test-ids/hud-test-ids';
import { catalogCards } from '../format/catalog-cards';
import { isCardSheetRouteEnabled } from './card-sheet-route';
import { TraitCardSheetComponent } from './card-sheet.component';

describe('isCardSheetRouteEnabled', () => {
  it('opens only on ?cards in a development build', () => {
    expect(isCardSheetRouteEnabled(true, '?cards')).toBe(true);
    expect(isCardSheetRouteEnabled(true, '?kit&cards')).toBe(true);
    expect(isCardSheetRouteEnabled(true, '?kit')).toBe(false);
    expect(isCardSheetRouteEnabled(true, null)).toBe(false);
    expect(isCardSheetRouteEnabled(false, '?cards')).toBe(false);
  });
});

describe('TraitCardSheetComponent', () => {
  it('draws every catalog card through the real trait card, each named for the height guard, under the HUD variables', () => {
    TestBed.configureTestingModule({ imports: [TraitCardSheetComponent] });
    const fixture = TestBed.createComponent(TraitCardSheetComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const sheet = root.querySelector<HTMLElement>(`[data-testid="${HUD_TEST_ID.traitCardSheet}"]`);
    // The card reads its size from these; without them every card would be a zero box and every guard would pass.
    expect(sheet?.style.getPropertyValue('--hud-picker-card-height')).not.toBe('');
    const drawn = [...root.querySelectorAll<HTMLElement>('app-trait-card[data-card-id]')].map(
      (card) => card.dataset['cardId'],
    );
    expect(drawn).toEqual(catalogCards(DEFAULT_BALANCE.traits).map((card) => card.cardId));
    expect(root.querySelectorAll('app-trait-card .card .rarity')).toHaveLength(drawn.length);
  });
});
