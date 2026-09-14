// The trait picker (docs/ui/overlays.md §3.2): while the own player has an offer open, a dim over the dish with the
// own cell's exclusion disc left clear, and a band hung from the exclusion box's bottom edge — the title, the
// countdown bar and text, three cards and the footer. The dish keeps running and the cell keeps steering: only the
// cards take the pointer. A highlighted card previews its trait on the own cell (`HudStateService.previewTraitId`);
// a pick goes through the same input seam as the `1` `2` `3` keys. The record is `traitOfferViewFor`'s.

import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, untracked } from '@angular/core';
import type { TraitId } from '@evolution/shared';
import { GameStateService } from '../state/game-state.service';
import { traitOfferViewFor, type TraitOfferViewModel } from './format/trait-cards';
import { HudStateService } from './hud-state.service';
import { HUD_TEST_ID } from './test-ids';
import { TraitCardComponent } from './trait-card.component';

const PERCENT = 100;

@Component({
  selector: 'app-trait-offer-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TraitCardComponent],
  template: `
    @if (view(); as offer) {
      <div class="dim" aria-hidden="true"></div>
      <section class="band" role="dialog" aria-label="Choose a trait" [attr.data-testid]="testId.traitOffer">
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
            <app-trait-card [card]="card" (previewed)="preview($event)" (picked)="pick($event)" />
          }
        </div>
      </section>
    }
  `,
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      /* A DOM dim, never a Pixi quad; the own cell's exclusion disc stays clear (docs/ui/overlays.md §3.2). */
      .dim {
        position: absolute;
        inset: 0;
        background: rgb(0 0 0 / var(--hud-picker-dim-alpha));
        -webkit-mask-image: radial-gradient(
          circle at 50% 50%,
          transparent calc(var(--hud-exclusion) * 0.85 * var(--hud-scale)),
          black calc(var(--hud-exclusion) * var(--hud-scale))
        );
        mask-image: radial-gradient(
          circle at 50% 50%,
          transparent calc(var(--hud-exclusion) * 0.85 * var(--hud-scale)),
          black calc(var(--hud-exclusion) * var(--hud-scale))
        );
      }

      /* Hung from the exclusion box's bottom edge, centred on the own cell: never an absolute y. */
      .band {
        position: absolute;
        left: 50%;
        top: calc(50% + (var(--hud-exclusion) + var(--hud-picker-band-gap)) * var(--hud-scale));
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: calc(var(--hud-picker-row-gap) * var(--hud-scale));
        margin: 0;
      }

      /* Each row is exactly its own height, so the cards land where §3.2's worked example puts them. */
      .title {
        margin: 0;
        line-height: 1;
        font-family: var(--hud-font-sans);
        font-size: calc(var(--hud-type-title) * var(--hud-scale));
        font-weight: 600;
        color: var(--hud-level-gold);
        text-shadow: 0 1px 3px var(--hud-outline);
      }

      /*
       * The row is the bar: the timer text sits right of it and the footer left of it, both out of flow, so the
       * row adds no height and nothing hangs under the key chips (docs/ui/overlays.md §3.2).
       */
      .timer-row {
        position: relative;
      }

      .timer-text,
      .footer {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        margin: 0;
        line-height: 1;
        white-space: nowrap;
      }

      .timer-track {
        width: calc(var(--hud-picker-timer-width) * var(--hud-scale));
        height: calc(var(--hud-picker-timer-height) * var(--hud-scale));
        background: var(--hud-panel-bottom);
      }

      .timer-fill {
        height: 100%;
        background: var(--hud-level-gold);
      }

      .timer-text {
        left: 100%;
        padding-left: calc(var(--hud-picker-row-gap) * var(--hud-scale));
        font-family: var(--hud-font-mono);
        font-size: calc(var(--hud-type-value) * var(--hud-scale));
        font-variant-numeric: tabular-nums;
        color: var(--hud-text);
      }

      .cards {
        display: flex;
        gap: calc(var(--hud-picker-card-gap) * var(--hud-scale));
      }

      .footer {
        right: 100%;
        padding-right: calc(var(--hud-picker-row-gap) * var(--hud-scale));
        font-family: var(--hud-font-sans);
        font-size: calc(var(--hud-type-caption) * var(--hud-scale));
        color: var(--hud-text-muted);
      }
    `,
  ],
})
export class TraitOfferOverlayComponent {
  private readonly hudState = inject(HudStateService);
  private readonly gameState = inject(GameStateService);

  protected readonly percent = PERCENT;
  protected readonly testId = HUD_TEST_ID;

  /** The open offer as the band reads it; `null` with no offer, no progress or no balance yet. */
  protected readonly view = computed<TraitOfferViewModel | null>(() => {
    const progress = this.gameState.ownProgress();
    const balance = this.gameState.balance();
    const offer = progress?.offer ?? null;
    if (progress === null || offer === null || balance === null) return null;
    return traitOfferViewFor({
      offer,
      level: progress.level,
      ownCell: this.gameState.ownCell(),
      serverTick: this.gameState.serverTickEstimate() ?? offer.expiresAtTick,
      balance,
    });
  });

  constructor() {
    // An offer that closes (picked, timed out) takes its preview with it, so no ghost outlives the band.
    effect(() => {
      if (this.view() === null) untracked(() => this.hudState.setPreviewTraitId(null));
    });
    inject(DestroyRef).onDestroy(() => this.hudState.setPreviewTraitId(null));
  }

  protected preview(traitId: TraitId | null): void {
    this.hudState.setPreviewTraitId(traitId);
  }

  protected pick(cardIndex: number): void {
    this.hudState.pickTraitCard(cardIndex);
  }
}
