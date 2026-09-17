// A run of entry rows (docs/ui/encyclopedia.md §11.3), so the row is written once whether it sits under a section
// header or bare. Its host is `display: contents`: the rows are the list's own flex children and the kit's roving
// focus walks them in document order, exactly as if they had been written in the list's template.
//
// It is a component rather than an `<ng-template>` in the list: a template's content injects from where it was
// *declared*, so `ui-list-row` would look for its group above the `ui-list` it is drawn inside and find nothing.

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { isRovingSelectKey } from '../../ui-kit/roving-group';
import { UiListRowComponent } from '../../ui-kit/ui-list-row.component';
import { EncyclopediaGlyphComponent } from './encyclopedia-glyph.component';
import type { EntryLink } from './model/entry';
import type { EntryId } from './model/entry-id';
import { encyclopediaRowTestId } from './test-ids';

@Component({
  selector: 'app-encyclopedia-list-rows',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EncyclopediaGlyphComponent, UiListRowComponent],
  styleUrl: './encyclopedia-list-rows.component.css',
  template: `
    @for (entry of entries(); track entry.entryId) {
      <ui-list-row
        [itemId]="entry.entryId"
        [testId]="rowTestId(entry.entryId)"
        (click)="activated.emit(entry.entryId)"
        (keydown)="activateOnSelectKey($event, entry.entryId)"
      >
        <app-encyclopedia-glyph uiLeading class="glyph" [entryId]="entry.entryId" />
        {{ entry.title }}
      </ui-list-row>
    }
  `,
})
export class EncyclopediaListRowsComponent {
  readonly entries = input.required<readonly EntryLink[]>();

  /**
   * A row the reader **activated**, as opposed to one the roving focus merely passed over: a click, or Enter or
   * Space on it. The list column owns what that means (§11.5: activating pushes, roving replaces); the rows only
   * report which row it was, because the kit's own report cannot say — it is silent for an activation of the row
   * already selected, and identical to a rove for any other.
   */
  readonly activated = output<EntryId>();

  protected readonly rowTestId = encyclopediaRowTestId;

  /** Bound on the row, so it runs before the kit's handler on the list above it — the one order the DOM guarantees. */
  protected activateOnSelectKey(event: KeyboardEvent, entryId: EntryId): void {
    if (isRovingSelectKey(event.key)) this.activated.emit(entryId);
  }
}
