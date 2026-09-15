// A keycap (docs/ui/components-and-constants.md §10.2): `caption`, muted, on the well with a panel-rim rim. It
// repeats what the control beside it already says to assistive technology (`aria-keyshortcuts`), so it
// is hidden from it.

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { keyCapLabel } from './format/key-cap-label';

@Component({
  selector: 'ui-key-hint',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ label() }}`,
  host: { 'aria-hidden': 'true' },
  styles: [
    `
      :host {
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        height: calc(var(--ui-key-hint-height) * var(--ui-scale));
        min-width: calc(var(--ui-key-hint-height) * var(--ui-scale));
        padding: 0 calc(var(--ui-space-xs) * var(--ui-scale));
        border: calc(var(--ui-rim) * var(--ui-scale)) solid var(--ui-panel-rim);
        border-radius: calc(var(--ui-radius-control) * var(--ui-scale));
        background-color: var(--ui-well);
        color: var(--ui-text-muted);
        font-family: var(--ui-font-sans);
        font-size: calc(var(--ui-type-caption) * var(--ui-scale));
        font-weight: bold;
        line-height: 1;
        letter-spacing: var(--ui-label-tracking);
        text-transform: uppercase;
        white-space: nowrap;
      }
    `,
  ],
})
export class UiKeyHintComponent {
  /** The key, named as `KeyboardEvent.key` names it (`Escape`, `H`, `/`). */
  readonly key = input.required<string>();

  protected readonly label = computed(() => keyCapLabel(this.key()));
}
