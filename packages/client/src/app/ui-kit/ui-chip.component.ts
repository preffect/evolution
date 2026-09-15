// The kit's chips (docs/ui/components-and-constants.md §10.2). `ui-chip` is a static pill: `label` text plus
// `UI_CHIP_PADDING_INLINE_PX` at each end, a rim and text in its tone, an optional dot. The tones are the palette's
// (principles-and-palette.md §2, UI kit roles): `muted`, `neutral` and `strong` are the three greys a rarity or a tag
// takes, `dna` the rare rarity, `gold` and `danger` their cues, and `accent` a selection and nothing else.
//
// The link chip is interactive: a compact secondary button in the link colour, so it wears the button's stylesheet
// and every state of it rather than a copy.

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export const UI_CHIP_TONE = {
  muted: 'muted',
  neutral: 'neutral',
  strong: 'strong',
  accent: 'accent',
  gold: 'gold',
  danger: 'danger',
  dna: 'dna',
} as const;
export type UiChipTone = (typeof UI_CHIP_TONE)[keyof typeof UI_CHIP_TONE];

@Component({
  selector: 'ui-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (dotColour(); as colour) {
      <span class="dot" aria-hidden="true" [style.background-color]="colour"></span>
    }
    <ng-content />
  `,
  host: { '[attr.data-tone]': 'tone()', '[attr.data-testid]': 'testId()' },
  styleUrl: './ui-chip.component.css',
})
export class UiChipComponent {
  readonly tone = input<UiChipTone>(UI_CHIP_TONE.neutral);
  /** A colour role's value for the leading dot (a DNA tag's colour); none draws no dot. */
  readonly dotColour = input<string | null>(null);
  readonly testId = input<string | null>(null);
}

@Component({
  selector: 'a[uiLinkChip], button[uiLinkChip]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: { 'data-variant': 'secondary', 'data-size': 'compact', '[attr.data-testid]': 'testId()' },
  styleUrls: ['./ui-button.component.css'],
  styles: [
    `
      :host([data-variant='secondary'][data-size='compact']) {
        color: var(--ui-link);
        text-decoration: none;
      }
    `,
  ],
})
export class UiLinkChipComponent {
  readonly testId = input<string | null>(null);
}
