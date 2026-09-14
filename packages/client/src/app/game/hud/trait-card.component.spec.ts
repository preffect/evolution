import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, createTestPlayerProgressView, type TraitId } from '@evolution/shared';
import { CARD_POINTER, type CardPointerEvent } from './format/card-highlight';
import { traitOfferViewFor, type TraitCardView } from './format/trait-cards';
import { HUD_TEST_ID, testIdSelector, traitCardPickTestId } from './test-ids';
import { TraitCardComponent } from './trait-card.component';

const [FRESH_CARD, UPGRADE_CARD] = traitOfferViewFor({
  offer: {
    offerId: 1,
    level: 3,
    expiresAtTick: 0,
    cards: [
      { traitId: 'cell_wall' as TraitId, tier: 1 },
      { traitId: 'simple_flagellum' as TraitId, tier: 2 },
    ],
  },
  progress: createTestPlayerProgressView({ ownedTraits: [{ traitId: 'simple_flagellum' as TraitId, tier: 1 }] }),
  serverTick: 0,
  balance: DEFAULT_BALANCE,
}).cards;

describe('TraitCardComponent', () => {
  let fixture: ComponentFixture<TraitCardComponent>;

  function mount(card: TraitCardView | undefined, isHighlighted = false): HTMLButtonElement {
    fixture.componentRef.setInput('card', card);
    fixture.componentRef.setInput('isHighlighted', isHighlighted);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      testIdSelector(traitCardPickTestId(card?.index ?? 0)),
    )!;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TraitCardComponent] });
    fixture = TestBed.createComponent(TraitCardComponent);
  });

  it('marks an upgrade with I → II under the upgrade test id, and a fresh trait without one', () => {
    const upgrade = mount(UPGRADE_CARD).querySelector(testIdSelector(HUD_TEST_ID.traitCardUpgrade));
    expect(upgrade?.textContent?.trim()).toBe('I → II');
    expect(mount(FRESH_CARD).querySelector(testIdSelector(HUD_TEST_ID.traitCardUpgrade))).toBeNull();
  });

  it('names its key, trait, tier and effects to assistive technology', () => {
    const button = mount(UPGRADE_CARD);
    expect(button.getAttribute('aria-label')).toBe(
      `2: ${UPGRADE_CARD!.name} I → II, ${UPGRADE_CARD!.effects.join(', ')}`,
    );
  });

  it('reports hover, focus, blur and leave with its index, and picks on click', () => {
    const events: CardPointerEvent[] = [];
    const picks: number[] = [];
    fixture.componentInstance.pointerChanged.subscribe((event) => events.push(event));
    fixture.componentInstance.picked.subscribe((cardIndex) => picks.push(cardIndex));
    const button = mount(UPGRADE_CARD);
    button.dispatchEvent(new MouseEvent('mouseenter'));
    button.dispatchEvent(new FocusEvent('focus'));
    button.dispatchEvent(new FocusEvent('blur'));
    button.dispatchEvent(new MouseEvent('mouseleave'));
    button.click();
    expect(events).toEqual(
      [CARD_POINTER.entered, CARD_POINTER.focused, CARD_POINTER.blurred, CARD_POINTER.left].map((kind) => ({
        kind,
        cardIndex: 1,
      })),
    );
    expect(picks).toEqual([1]);
  });

  it('lifts only while the overlay names it the highlight', () => {
    expect(mount(FRESH_CARD).classList.contains('highlighted')).toBe(false);
    expect(mount(FRESH_CARD, true).classList.contains('highlighted')).toBe(true);
  });
});
