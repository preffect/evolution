import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  TICK_HZ,
  createTestPlayerProgressView,
  createTestSnapshot,
  playerId,
  type TraitId,
  type TraitOfferView,
} from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import { MultiplayerService } from '../../services/multiplayer.service';
import { HudStateService } from './hud-state.service';
import { HUD_TEST_ID, testIdSelector, traitCardPickTestId, traitCardTestId } from './test-ids';
import { TraitOfferOverlayComponent } from './trait-offer-overlay.component';

const OWN_PLAYER_ID = playerId('player-me');
const SNAPSHOT_TICK = 5000;

const offer: TraitOfferView = {
  offerId: 3,
  expiresAtTick: SNAPSHOT_TICK + 6.5 * TICK_HZ,
  cards: [
    { traitId: 'nucleoid' as TraitId, tier: 1 },
    { traitId: 'simple_flagellum' as TraitId, tier: 1 },
    { traitId: 'cell_wall' as TraitId, tier: 1 },
  ],
};

/** The next queued offer, replacing the cards in place with no snapshot between that lacks an offer. */
const nextOffer: TraitOfferView = {
  ...offer,
  offerId: 4,
  cards: [
    { traitId: 'cytoskeleton' as TraitId, tier: 1 },
    { traitId: 'cell_wall' as TraitId, tier: 2 },
    { traitId: 'simple_flagellum' as TraitId, tier: 2 },
  ],
};

describe('TraitOfferOverlayComponent', () => {
  let fixture: ComponentFixture<TraitOfferOverlayComponent>;
  let multiplayer: MultiplayerService;
  let hudState: HudStateService;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function query(testId: string): HTMLElement | null {
    return root().querySelector(testIdSelector(testId));
  }

  function pickButton(cardIndex: number): HTMLElement {
    return query(traitCardPickTestId(cardIndex))!;
  }

  function highlightedCards(): number[] {
    return offer.cards.flatMap((_card, index) => (pickButton(index).classList.contains('highlighted') ? [index] : []));
  }

  /** Runs the effects a card event or a snapshot starts, then renders. */
  function settle(): void {
    TestBed.tick();
  }

  function showOffer(open: TraitOfferView | null): void {
    multiplayer.playerId.set(OWN_PLAYER_ID);
    multiplayer.balance.set(DEFAULT_BALANCE);
    multiplayer.snapshot.set(
      createTestSnapshot({
        tick: SNAPSHOT_TICK,
        cells: [createTestCellView({ playerId: OWN_PLAYER_ID, stage: CELL_STAGE.protocell })],
        players: { [OWN_PLAYER_ID]: createTestPlayerProgressView({ playerId: OWN_PLAYER_ID, level: 2, offer: open }) },
      }),
    );
    fixture.detectChanges();
    settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TraitOfferOverlayComponent] });
    multiplayer = TestBed.inject(MultiplayerService);
    hudState = TestBed.inject(HudStateService);
    fixture = TestBed.createComponent(TraitOfferOverlayComponent);
  });

  it('shows nothing without an open offer', () => {
    showOffer(null);
    expect(query(HUD_TEST_ID.traitOffer)).toBeNull();
  });

  it('opens the band as a dialog with the title, the countdown and one card per offered trait', () => {
    showOffer(offer);
    const band = query(HUD_TEST_ID.traitOffer)!;
    expect(band.getAttribute('role')).toBe('dialog');
    expect(band.getAttribute('aria-label')).toBe('Choose a trait');
    expect(band.textContent).toContain('LEVEL 2 · CHOOSE A TRAIT');
    expect(query(HUD_TEST_ID.traitOfferTimer)!.textContent!.trim()).toBe('6.5 s');
    expect(offer.cards.map((_card, index) => query(traitCardTestId(index)))).not.toContain(null);
    expect(band.textContent).toContain('At 0 s the dish picks for you');
  });

  it('ribbons the rung card: the nucleoid climbs a protocell to prokaryote', () => {
    showOffer(offer);
    expect(query(traitCardTestId(0))!.querySelector(testIdSelector(HUD_TEST_ID.traitCardRung))).not.toBeNull();
    expect(query(traitCardTestId(1))!.querySelector(testIdSelector(HUD_TEST_ID.traitCardRung))).toBeNull();
  });

  it('highlights and previews no card until one is hovered or focused', () => {
    showOffer(offer);
    expect(highlightedCards()).toEqual([]);
    expect(hudState.previewTraitId()).toBeNull();
  });

  it('highlights and previews the hovered card, else the focused one, and only ever one', () => {
    showOffer(offer);
    pickButton(0).dispatchEvent(new FocusEvent('focus'));
    settle();
    expect([highlightedCards(), hudState.previewTraitId()]).toEqual([[0], 'nucleoid']);

    pickButton(1).dispatchEvent(new MouseEvent('mouseenter'));
    settle();
    expect([highlightedCards(), hudState.previewTraitId()]).toEqual([[1], 'simple_flagellum']);

    // The pointer leaves while card 0 still has focus: the highlight and the preview fall back to it.
    pickButton(1).dispatchEvent(new MouseEvent('mouseleave'));
    settle();
    expect([highlightedCards(), hudState.previewTraitId()]).toEqual([[0], 'nucleoid']);

    pickButton(0).dispatchEvent(new FocusEvent('blur'));
    settle();
    expect([highlightedCards(), hudState.previewTraitId()]).toEqual([[], null]);
  });

  it('picks through the room’s input seam on a click, the same path as the 1 2 3 keys', () => {
    const pick = vi.fn();
    hudState.setTraitCardPick(pick);
    showOffer(offer);
    pickButton(2).click();
    expect(pick).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('lets the preview go when the offer closes, so no ghost outlives the band', () => {
    showOffer(offer);
    pickButton(0).dispatchEvent(new MouseEvent('mouseenter'));
    settle();
    expect(hudState.previewTraitId()).toBe('nucleoid');
    showOffer(null);
    expect(hudState.previewTraitId()).toBeNull();
  });

  it('lets the preview go when a queued offer replaces the cards in place, with no leave or blur', () => {
    showOffer(offer);
    pickButton(0).dispatchEvent(new MouseEvent('mouseenter'));
    settle();
    expect(hudState.previewTraitId()).toBe('nucleoid');
    showOffer(nextOffer);
    expect(query(HUD_TEST_ID.traitOffer)).not.toBeNull();
    expect([highlightedCards(), hudState.previewTraitId()]).toEqual([[], null]);
  });

  it('gives focus back to the canvas host when the offer closes with focus inside the band', () => {
    const canvasHost = document.createElement('div');
    canvasHost.tabIndex = 0;
    document.body.append(canvasHost);
    showOffer(offer);
    pickButton(0).focus();
    pickButton(0).dispatchEvent(new FocusEvent('focusin', { bubbles: true, relatedTarget: canvasHost }));
    showOffer(null);
    expect(document.activeElement).toBe(canvasHost);
    canvasHost.remove();
  });
});
