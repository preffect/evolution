// One trait card (docs/ui/overlays.md §3.2): a native button, so a click, Enter or Space on the focused card picks
// it; hovering or focusing it previews the trait, and leaving it lets the preview go. It decides nothing:
// `traitOfferViewFor` built the record it binds. The key chip under it is a label, not a control.

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { TraitId } from '@evolution/shared';
import type { TraitCardView } from './format/trait-cards';
import { HUD_TEST_ID, traitCardPickTestId, traitCardTestId } from './test-ids';

@Component({
  selector: 'app-trait-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-testid]': 'hostTestId()' },
  template: `
    <button
      type="button"
      class="card"
      [class.rung]="card().isRung"
      [attr.data-testid]="pickTestId()"
      [attr.aria-label]="ariaLabel()"
      (mouseenter)="previewed.emit(card().traitId)"
      (focus)="previewed.emit(card().traitId)"
      (mouseleave)="previewed.emit(null)"
      (blur)="previewed.emit(null)"
      (click)="picked.emit(card().index)"
    >
      @if (card().isRung) {
        <span class="ribbon" [attr.data-testid]="testId.traitCardRung">Rung</span>
      }
      <span class="medallion" aria-hidden="true">{{ card().categoryInitial }}</span>
      <span class="category">{{ card().category }}</span>
      <span class="name">
        {{ card().name }}
        <span class="tier" [attr.data-testid]="card().isUpgrade ? testId.traitCardUpgrade : null">{{
          card().tierLabel
        }}</span>
      </span>
      @for (line of card().effects; track $index) {
        <span class="effect">{{ line }}</span>
      }
      <span class="rarity">{{ card().rarity }}</span>
    </button>
    <span class="key-chip" aria-hidden="true">{{ card().keyLabel }}</span>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: calc(var(--hud-picker-key-chip-gap) * var(--hud-scale));
      }

      .card {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: calc(4px * var(--hud-scale));
        width: calc(var(--hud-picker-card-width) * var(--hud-scale));
        height: calc(var(--hud-picker-card-height) * var(--hud-scale));
        padding: calc(10px * var(--hud-scale)) calc(8px * var(--hud-scale));
        box-sizing: border-box;
        border: 1px solid var(--hud-panel-rim);
        border-radius: calc(var(--hud-leaderboard-corner-radius) * var(--hud-scale));
        background: linear-gradient(var(--hud-panel-top), var(--hud-panel-bottom));
        color: var(--hud-text);
        font-family: var(--hud-font-sans);
        cursor: pointer;
        pointer-events: auto;
        transition:
          transform 120ms ease-out,
          box-shadow 120ms ease-out;
      }

      /* Highlight = hover = keyboard focus = preview (docs/ui/overlays.md §3.2). */
      .card:hover,
      .card:focus-visible {
        transform: translateY(calc(var(--hud-picker-card-lift) * -1 * var(--hud-scale)));
        box-shadow: 0 0 calc(12px * var(--hud-scale)) var(--hud-level-gold);
        outline: 2px solid var(--hud-text);
        outline-offset: 2px;
      }

      .ribbon {
        position: absolute;
        top: 0;
        right: 0;
        padding: 0 calc(6px * var(--hud-scale));
        background: var(--hud-level-gold);
        color: var(--hud-panel-bottom);
        font-size: calc(var(--hud-type-caption) * var(--hud-scale));
        text-transform: uppercase;
        letter-spacing: var(--hud-label-tracking);
      }

      .medallion {
        display: grid;
        place-items: center;
        width: calc(var(--hud-picker-medallion) * var(--hud-scale));
        height: calc(var(--hud-picker-medallion) * var(--hud-scale));
        border-radius: 50%;
        border: 1px solid var(--hud-panel-rim);
        font-size: calc(var(--hud-type-title) * var(--hud-scale));
        color: var(--hud-level-gold);
      }

      .category,
      .rarity {
        font-size: calc(var(--hud-type-caption) * var(--hud-scale));
        text-transform: uppercase;
        letter-spacing: var(--hud-label-tracking);
        color: var(--hud-text-label);
      }

      .name {
        font-size: calc(var(--hud-type-card-name) * var(--hud-scale));
        font-weight: 700;
        text-align: center;
      }

      .effect {
        font-size: calc(var(--hud-type-label) * var(--hud-scale));
        color: var(--hud-text);
        text-align: center;
      }

      .key-chip {
        font-size: calc(var(--hud-type-caption) * var(--hud-scale));
        color: var(--hud-text-muted);
      }
    `,
  ],
})
export class TraitCardComponent {
  readonly card = input.required<TraitCardView>();
  /** The trait to preview, or `null` when the card is let go. */
  readonly previewed = output<TraitId | null>();
  /** The card's index in the offer. */
  readonly picked = output<number>();

  protected readonly testId = HUD_TEST_ID;
  protected readonly hostTestId = computed(() => traitCardTestId(this.card().index));
  protected readonly pickTestId = computed(() => traitCardPickTestId(this.card().index));
  protected readonly ariaLabel = computed(() => {
    const card = this.card();
    return `${card.keyLabel}: ${card.name} ${card.tierLabel}, ${card.effects.join(', ')}`;
  });
}
