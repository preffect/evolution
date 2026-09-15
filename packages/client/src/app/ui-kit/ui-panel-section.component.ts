// A section of a panel (docs/ui/components-and-constants.md §10.2, the `side` panel): a `label` heading over its
// content, `UI_SPACE_M_PX` below the section before it with a 1 px `PANEL_RIM` rule between them.

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { nextUiElementId } from './ui-element-id';

@Component({
  selector: 'ui-panel-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3 class="heading" [id]="headingId">{{ heading() }}</h3>
    <ng-content />
  `,
  host: {
    role: 'group',
    '[attr.aria-labelledby]': 'headingId',
    '[attr.data-testid]': 'testId()',
  },
  styles: [
    `
      :host {
        display: block;
      }

      :host:not(:first-child) {
        margin-top: calc(var(--ui-space-m) * var(--ui-scale));
        padding-top: calc(var(--ui-space-m) * var(--ui-scale));
        border-top: calc(var(--ui-rim) * var(--ui-scale)) solid var(--ui-panel-rim);
      }

      .heading {
        margin: 0 0 calc(var(--ui-space-xs) * var(--ui-scale));
        color: var(--ui-text-label);
        font-size: calc(var(--ui-type-label) * var(--ui-scale));
        font-weight: bold;
        letter-spacing: var(--ui-label-tracking);
        text-transform: uppercase;
      }
    `,
  ],
})
export class UiPanelSectionComponent {
  readonly heading = input.required<string>();
  readonly testId = input<string | null>(null);

  protected readonly headingId = nextUiElementId('ui-panel-section');
}
