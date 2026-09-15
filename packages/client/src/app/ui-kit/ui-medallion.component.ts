// The kit's medallion (docs/ui/components-and-constants.md §10.2): a round well for a mark with no disc of its own (a
// subject icon, a still frame, a tier numeral), `UI_ROW_MEDALLION_PX` in a row or `UI_CARD_MEDALLION_PX` on a card. A
// trait glyph (#312) draws its own disc and rim and is placed bare, never in one.

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export const UI_MEDALLION_SIZE = { row: 'row', card: 'card' } as const;
export type UiMedallionSize = (typeof UI_MEDALLION_SIZE)[keyof typeof UI_MEDALLION_SIZE];

export const UI_MEDALLION_TONE = { neutral: 'neutral', gold: 'gold' } as const;
export type UiMedallionTone = (typeof UI_MEDALLION_TONE)[keyof typeof UI_MEDALLION_TONE];

@Component({
  selector: 'ui-medallion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: { '[attr.data-size]': 'size()', '[attr.data-tone]': 'tone()', '[attr.data-testid]': 'testId()' },
  styles: [
    `
      :host {
        box-sizing: border-box;
        display: inline-flex;
        flex: none;
        align-items: center;
        justify-content: center;
        width: calc(var(--ui-row-medallion) * var(--ui-scale));
        height: calc(var(--ui-row-medallion) * var(--ui-scale));
        overflow: hidden;
        border: calc(var(--ui-rim) * var(--ui-scale)) solid var(--ui-panel-rim);
        border-radius: 50%;
        background-color: var(--ui-well);
        color: var(--ui-text-label);
        font-family: var(--ui-font-sans);
        font-size: calc(var(--ui-type-label) * var(--ui-scale));
        font-weight: bold;
        line-height: 1;
      }

      :host([data-size='card']) {
        width: calc(var(--ui-card-medallion) * var(--ui-scale));
        height: calc(var(--ui-card-medallion) * var(--ui-scale));
      }

      :host([data-tone='gold']) {
        border-color: var(--ui-level-gold);
        color: var(--ui-level-gold);
      }
    `,
  ],
})
export class UiMedallionComponent {
  readonly size = input<UiMedallionSize>(UI_MEDALLION_SIZE.row);
  readonly tone = input<UiMedallionTone>(UI_MEDALLION_TONE.neutral);
  readonly testId = input<string | null>(null);
}
