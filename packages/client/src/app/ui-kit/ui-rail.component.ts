// The kit's rail (docs/ui/components-and-constants.md §10.2): a `tablist` of rail items, vertical (the encyclopedia's
// categories) or horizontal (tabs sized to their labels), one Tab stop with a roving focus, and selection following
// focus, so arrowing through it shows each page in turn.

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UI_ORIENTATION, UiRovingGroup, provideRovingGroup, type UiOrientation } from './roving-group';

@Component({
  selector: 'ui-rail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideRovingGroup(() => UiRailComponent)],
  template: `<ng-content />`,
  host: { role: 'tablist', '[attr.data-orientation]': 'orientation()' },
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
      }

      :host([data-orientation='horizontal']) {
        flex-direction: row;
      }
    `,
  ],
})
export class UiRailComponent extends UiRovingGroup {
  override readonly orientation = input<UiOrientation>(UI_ORIENTATION.vertical);

  protected readonly isSelectionFollowingFocus = (): boolean => true;
}
