// One list row (docs/ui/components-and-constants.md §10.2): an `option` with a leading slot (`[uiLeading]`, a medallion
// or a glyph), its title in `body` ending in an ellipsis when it does not fit, and a trailing slot (`[uiTrailing]`).
// Its Tab stop, selection and keys are its list's.

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UiRovingItemBase } from './roving-group';

@Component({
  selector: 'ui-list-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="leading"><ng-content select="[uiLeading]" /></span>
    <span class="label"><ng-content /></span>
    <span class="trailing"><ng-content select="[uiTrailing]" /></span>
  `,
  host: { role: 'option' },
  styleUrls: ['./ui-row-states.css'],
  styles: [
    `
      :host {
        height: calc(var(--ui-row-height) * var(--ui-scale));
        color: var(--ui-text);
      }
    `,
  ],
})
export class UiListRowComponent extends UiRovingItemBase {}
