// The trait picker (docs/ui/overlays.md §3.2): while the own player has an offer open, a dim over the dish with the
// own cell's exclusion disc left clear, and a band hung from the exclusion box's bottom edge — the title, the
// countdown bar with its text and the footer, and three cards. The dish keeps running and the cell keeps steering:
// only the cards take the pointer. It owns the one highlight (the hovered card, else the focused one), and the
// highlighted card's trait is the preview on the own cell (`HudStateService.previewTraitId`); a pick goes through the
// same input seam as the `1` `2` `3` keys. Non-modal: it traps no focus, and gives back any it held when it closes.
// The record is `traitOfferViewFor`'s.

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import type { TraitId } from '@evolution/shared';
import { GameStateService } from '../state/game-state.service';
import {
  NO_CARD_HIGHLIGHT,
  highlightedCardIndex,
  nextCardHighlight,
  type CardPointerEvent,
} from './format/card-highlight';
import { traitOfferViewFor, type TraitOfferViewModel } from './format/trait-cards';
import { FocusReturn } from './focus-return';
import { PERCENT } from './hud-constants';
import { HudStateService } from './hud-state.service';
import { HUD_TEST_ID } from './test-ids';
import { TraitCardComponent } from './trait-card.component';

@Component({
  selector: 'app-trait-offer-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TraitCardComponent],
  styleUrl: './trait-offer-overlay.component.css',
  template: `
    @if (view(); as offer) {
      <div class="dim" aria-hidden="true"></div>
      <section
        class="band"
        role="dialog"
        aria-label="Choose a trait"
        [attr.data-testid]="testId.traitOffer"
        (focusin)="focusReturn.enter($event)"
        (focusout)="focusReturn.leave($event)"
      >
        <h2 class="title">{{ offer.title }}</h2>
        <div class="timer-row">
          <p class="footer">At 0 s the dish picks for you</p>
          <div class="timer-track" aria-hidden="true">
            <div class="timer-fill" [style.width.%]="offer.timerFraction * percent"></div>
          </div>
          <span class="timer-text" role="timer" [attr.data-testid]="testId.traitOfferTimer">{{
            offer.secondsText
          }}</span>
        </div>
        <div class="cards">
          @for (card of offer.cards; track card.index) {
            <app-trait-card
              [card]="card"
              [isHighlighted]="card.index === highlightedIndex()"
              (pointerChanged)="pointerChanged($event)"
              (picked)="pick($event)"
            />
          }
        </div>
      </section>
    }
  `,
})
export class TraitOfferOverlayComponent {
  private readonly hudState = inject(HudStateService);
  private readonly gameState = inject(GameStateService);
  private readonly injector = inject(Injector);
  private readonly ownerDocument: Document = inject(ElementRef<HTMLElement>).nativeElement.ownerDocument;
  private readonly highlight = signal(NO_CARD_HIGHLIGHT);

  protected readonly percent = PERCENT;
  protected readonly testId = HUD_TEST_ID;
  protected readonly focusReturn = new FocusReturn();

  /** The open offer as the band reads it; `null` with no offer, no progress or no balance yet. */
  protected readonly view = computed<TraitOfferViewModel | null>(() => {
    const progress = this.gameState.ownProgress();
    const balance = this.gameState.balance();
    const offer = progress?.offer ?? null;
    if (progress === null || offer === null || balance === null) return null;
    return traitOfferViewFor({
      offer,
      progress,
      serverTick: this.gameState.serverTickEstimate() ?? offer.expiresAtTick,
      balance,
    });
  });

  /** The one highlighted card of the offer on screen; `null` for none. */
  protected readonly highlightedIndex = computed(() => {
    const offer = this.view();
    return offer === null ? null : highlightedCardIndex(this.highlight(), offer.offerId);
  });

  private readonly previewedTraitId = computed<TraitId | null>(() => {
    const index = this.highlightedIndex();
    return index === null ? null : (this.view()?.cards[index]?.traitId ?? null);
  });

  private readonly isOpen = computed(() => this.view() !== null);

  constructor() {
    // Highlight = preview: no ghost outlives its card, whether the offer closed or a new one replaced the cards.
    effect(() => this.hudState.setPreviewTraitId(this.previewedTraitId()));
    // Once the band has left the DOM, focus it held goes back where it came from (docs/ui/input-and-onboarding.md §4).
    effect(() => {
      if (this.isOpen()) return;
      afterNextRender(() => this.focusReturn.restore(this.ownerDocument), { injector: this.injector });
    });
    inject(DestroyRef).onDestroy(() => this.hudState.setPreviewTraitId(null));
  }

  protected pointerChanged(event: CardPointerEvent): void {
    const offer = this.view();
    if (offer !== null) this.highlight.update((current) => nextCardHighlight(current, offer.offerId, event));
  }

  protected pick(cardIndex: number): void {
    this.hudState.pickTraitCard(cardIndex);
  }
}
