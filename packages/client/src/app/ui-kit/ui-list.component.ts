// The kit's list (docs/ui/components-and-constants.md §10.2): a `listbox` of rows, directly or under list sections, one
// Tab stop with a roving focus over every row in document order, always vertical. Enter or Space selects the focused
// row; with `shouldSelectionFollowFocus` arrowing selects as it goes (the encyclopedia pages through entries that way).

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UiRovingGroup, provideRovingGroup } from './roving-group';

@Component({
  selector: 'ui-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideRovingGroup(() => UiListComponent)],
  template: `<ng-content />`,
  host: { role: 'listbox' },
  styles: [':host { display: flex; flex-direction: column; }'],
})
export class UiListComponent extends UiRovingGroup {
  readonly shouldSelectionFollowFocus = input(false);

  protected readonly isSelectionFollowingFocus = (): boolean => this.shouldSelectionFollowFocus();
}
