// The scrim under a modal panel (docs/ui/components-and-constants.md §10.2): the callout backing over the whole layer
// at the overlay's own alpha (`UI_SCRIM`, docs/visual-style/principles-and-palette.md §2). It takes the pointer, so
// a click never reaches the dish, and it closes nothing: closing is the overlay's decision, never a stray click's.

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-scrim',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: {
    'aria-hidden': 'true',
    '[style.--ui-scrim-alpha]': 'alpha()',
    '[attr.data-testid]': 'testId()',
  },
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        display: block;
        background-color: color-mix(in srgb, var(--ui-callout-backing) calc(var(--ui-scrim-alpha) * 100%), transparent);
        pointer-events: auto;
        animation: ui-scrim-enter var(--ui-panel-enter) ease-out both;
      }

      @keyframes ui-scrim-enter {
        from {
          opacity: 0;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        :host {
          animation: none;
        }
      }
    `,
  ],
})
export class UiScrimComponent {
  /** The overlay's own scrim alpha, in 0..1. */
  readonly alpha = input.required<number>();
  readonly testId = input<string | null>(null);
}
