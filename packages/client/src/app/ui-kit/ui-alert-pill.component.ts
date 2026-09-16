// The kit's alert pill (docs/ui/components-and-constants.md §10.2, the alert strip of encyclopedia.md §11.1): a button,
// `UI_ALERT_HEIGHT_PX` tall, on the callout backing with a dot and rim in its tone; the label in `WHITE`, uppercase,
// with any changing number in `figure` so its digits do not jitter, and optional trailing key hints. It wears the
// button's stylesheet for its states (hover, pressed, focus-visible) and overrides only its shape and tone.

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UiKeyHintComponent } from './ui-key-hint.component';

export const UI_ALERT_TONE = { danger: 'danger', gold: 'gold' } as const;
export type UiAlertTone = (typeof UI_ALERT_TONE)[keyof typeof UI_ALERT_TONE];

@Component({
  selector: 'button[uiAlertPill]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiKeyHintComponent],
  template: `
    <span class="dot" aria-hidden="true"></span>
    <span class="alert-label"><ng-content /></span>
    @if (figure(); as number) {
      <span class="figure">{{ number }}</span>
    }
    @if (keyHints().length > 0) {
      <span class="keys">
        @for (key of keyHints(); track key) {
          <ui-key-hint [key]="key" />
        }
      </span>
    }
  `,
  host: { '[attr.data-tone]': 'tone()', '[attr.data-testid]': 'testId()' },
  styleUrls: ['./ui-button.component.css'],
  styles: [
    `
      :host([data-tone]) {
        gap: calc(var(--ui-space-s) * var(--ui-scale));
        height: calc(var(--ui-alert-height) * var(--ui-scale));
        padding: 0 calc(var(--ui-space-m) * var(--ui-scale));
        border-radius: calc(var(--ui-alert-height) * var(--ui-scale));
        background-color: var(--ui-callout-backing);
        color: var(--ui-white);
        font-size: calc(var(--ui-type-label) * var(--ui-scale));
        font-weight: bold;
        letter-spacing: var(--ui-label-tracking);
      }

      :host([data-tone='danger']) {
        border-color: var(--ui-danger);
        --alert-tone: var(--ui-danger);
      }

      :host([data-tone='gold']) {
        border-color: var(--ui-level-gold);
        --alert-tone: var(--ui-level-gold);
      }

      .dot,
      .figure {
        flex: none;
      }

      .dot {
        width: calc(var(--ui-chip-dot) * var(--ui-scale));
        height: calc(var(--ui-chip-dot) * var(--ui-scale));
        border-radius: 50%;
        background-color: var(--alert-tone);
      }

      /* In a column narrower than the strip's words (a wide fallback face), the words give way with an ellipsis; the
         changing number and the keys, which the player acts on, never do. */
      .alert-label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-transform: uppercase;
      }

      /* The keys read as one set (\`1\` \`2\` \`3\`), closer to each other than to the text before them. */
      .keys {
        display: inline-flex;
        flex: none;
        gap: calc(var(--ui-space-xs) * var(--ui-scale));
      }

      .figure {
        font-family: var(--ui-font-mono);
        font-size: calc(var(--ui-type-figure) * var(--ui-scale));
        font-weight: normal;
        letter-spacing: normal;
      }
    `,
  ],
})
export class UiAlertPillComponent {
  readonly tone = input<UiAlertTone>(UI_ALERT_TONE.danger);
  /** The changing number after the label (`6.5 s`), already formatted. */
  readonly figure = input<string | null>(null);
  /** Keys shown after the pill's text, named as `KeyboardEvent.key` names them. */
  readonly keyHints = input<readonly string[]>([]);
  readonly testId = input<string | null>(null);
}
