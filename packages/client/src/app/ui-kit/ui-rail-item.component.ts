// One rail item (docs/ui/components-and-constants.md §10.2): a `tab` with an optional leading icon (`[uiLeading]`),
// its label, and an optional count in `figure`. Its Tab stop, selection and keys are its rail's.

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UiRovingItemBase } from './roving-group';

@Component({
  selector: 'ui-rail-item',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="leading"><ng-content select="[uiLeading]" /></span>
    <span class="label"><ng-content /></span>
    @if (count() !== null) {
      <span class="count">{{ count() }}</span>
    }
  `,
  host: { role: 'tab', '[attr.data-orientation]': 'group.orientation()' },
  styleUrls: ['./ui-row-states.css', './ui-rail-item.component.css'],
})
export class UiRailItemComponent extends UiRovingItemBase {
  readonly count = input<number | null>(null);
}
