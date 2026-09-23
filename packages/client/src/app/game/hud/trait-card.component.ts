// One trait card (docs/ui/overlays.md §3.2): a native button, so a click, Enter or Space on the focused card picks
// it. It reports its hover and focus changes and draws the highlight it is handed: the overlay owns the one highlight
// and the preview (`format/card-highlight.ts`). It decides nothing: `traitOfferViewFor` built the record it binds.
// The key chip in its bottom-right corner is a label, not a control.

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CARD_POINTER, type CardPointer, type CardPointerEvent } from './format/card-highlight';
import type { TraitCardView } from './format/trait-cards';
import { HUD_TEST_ID, traitCardPickTestId, traitCardTestId } from '../test-ids/hud-test-ids';
import { TraitGlyphComponent } from '../glyphs/trait-glyph.component';

@Component({
  selector: 'app-trait-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TraitGlyphComponent],
  host: { '[attr.data-testid]': 'hostTestId()' },
  styleUrl: './trait-card.component.css',
  template: `
    <button
      type="button"
      class="card"
      [class.highlighted]="isHighlighted()"
      [attr.data-testid]="pickTestId()"
      [attr.aria-label]="ariaLabel()"
      (mouseenter)="report(pointer.entered)"
      (mouseleave)="report(pointer.left)"
      (focus)="report(pointer.focused)"
      (blur)="report(pointer.blurred)"
      (click)="picked.emit(card().index)"
    >
      @if (card().isRung) {
        <span class="ribbon" [attr.data-testid]="testId.traitCardRung">Rung</span>
      }
      <app-trait-glyph class="medallion" [traitId]="card().traitId" />
      <span class="category">{{ card().category }}</span>
      <span class="name">
        {{ card().name }}
        <span class="tier" [attr.data-testid]="card().isUpgrade ? testId.traitCardUpgrade : null">{{
          card().tierLabel
        }}</span>
      </span>
      @for (line of card().effects; track $index) {
        <span class="effect" [attr.data-effect]="card().effectTones[$index]">{{ line }}</span>
      }
      <span class="rarity">{{ card().rarity }}</span>
      <span class="key-chip" aria-hidden="true">{{ card().keyLabel }}</span>
    </button>
  `,
})
export class TraitCardComponent {
  readonly card = input.required<TraitCardView>();
  /** This card is the overlay's one highlight: lifted and glowing. */
  readonly isHighlighted = input(false);
  /** The card was hovered, left, focused or blurred. */
  readonly pointerChanged = output<CardPointerEvent>();
  /** The card's index in the offer. */
  readonly picked = output<number>();

  protected readonly pointer = CARD_POINTER;
  protected readonly testId = HUD_TEST_ID;
  protected readonly hostTestId = computed(() => traitCardTestId(this.card().index));
  protected readonly pickTestId = computed(() => traitCardPickTestId(this.card().index));
  protected readonly ariaLabel = computed(() => {
    const card = this.card();
    return `${card.keyLabel}: ${card.name} ${card.tierLabel}, ${card.effects.join(', ')}`;
  });

  protected report(kind: CardPointer): void {
    this.pointerChanged.emit({ kind, cardIndex: this.card().index });
  }
}
