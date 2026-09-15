// A group of list rows under a `label` header (docs/ui/components-and-constants.md §10.2): `role="group"` labelled by
// its header, inside a `ui-list`, whose roving focus runs through every section's rows as one sequence.

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { nextUiElementId } from './ui-element-id';

@Component({
  selector: 'ui-list-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="header" [id]="headerId">{{ heading() }}</div>
    <ng-content />
  `,
  host: {
    role: 'group',
    '[attr.aria-labelledby]': 'headerId',
    '[attr.data-testid]': 'testId()',
  },
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
      }

      .header {
        padding: calc(var(--ui-space-m) * var(--ui-scale)) calc(var(--ui-space-l) * var(--ui-scale))
          calc(var(--ui-space-xs) * var(--ui-scale));
        color: var(--ui-text-label);
        font-family: var(--ui-font-sans);
        font-size: calc(var(--ui-type-label) * var(--ui-scale));
        font-weight: bold;
        line-height: 1;
        letter-spacing: var(--ui-label-tracking);
        text-transform: uppercase;
      }
    `,
  ],
})
export class UiListSectionComponent {
  readonly heading = input.required<string>();
  readonly testId = input<string | null>(null);

  protected readonly headerId = nextUiElementId('ui-list-section');
}
