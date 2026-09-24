// The entry list, and the search results in the same surface (docs/ui/encyclopedia.md §11.3, §11.5): a header naming
// what the column holds and how many, then kit list rows under their section headers.
//
// The two states share one template because `format/list-view.ts` gives them one shape. What differs is only where
// the sections come from: a category's groups, or the search's category runs. The core guarantees
// `resultGroups[0].results[0] === results[0]` for any query, so the row drawn first is the one Enter in the search
// field opens (`encyclopedia.component.ts`, §11.5) —
// nothing here re-derives that order.
//
// **Selection follows focus here** (§11.5): arrowing down the column pages through entries, so the detail column
// shows whatever the roving focus rests on. The kit reports an activation on its own (`activated`, ticket #622),
// before the selection change beside it, so a click or Enter pushes and a rove replaces with nothing to track here.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UiListComponent } from '../../ui-kit/ui-list.component';
import { UiListSectionComponent } from '../../ui-kit/ui-list-section.component';
import { UiScrollAreaComponent } from '../../ui-kit/ui-scroll-area.component';
import { EncyclopediaListRowsComponent } from './encyclopedia-list-rows.component';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import {
  categoryListHeader,
  categoryListSections,
  entryIdFromItemId,
  noMatchTextFor,
  searchListHeader,
  searchListSections,
} from './format/list-view';
import { ENCYCLOPEDIA_TEST_ID } from './test-ids';

@Component({
  selector: 'app-encyclopedia-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EncyclopediaListRowsComponent, UiListComponent, UiListSectionComponent, UiScrollAreaComponent],
  styleUrl: './encyclopedia-list.component.css',
  template: `
    <header class="column-header">
      <span class="label">{{ header().label }}</span>
      <span class="count">{{ header().count }}</span>
    </header>
    <ui-scroll-area class="scroll" [label]="header().label">
      @if (noMatchText(); as text) {
        <p class="no-results" [attr.data-testid]="testId.noResults">{{ text }}</p>
      }
      <ui-list
        class="list"
        [attr.aria-label]="header().label"
        [testId]="testId.list"
        [selectedId]="selectedId()"
        [shouldSelectionFollowFocus]="true"
        (activated)="activate($event)"
        (selectedIdChange)="roveTo($event)"
      >
        @for (section of sections(); track section.key) {
          @if (section.heading; as heading) {
            <ui-list-section [heading]="heading">
              <app-encyclopedia-list-rows [entries]="section.entries" />
            </ui-list-section>
          } @else {
            <app-encyclopedia-list-rows [entries]="section.entries" />
          }
        }
      </ui-list>
    </ui-scroll-area>
  `,
})
export class EncyclopediaListComponent {
  private readonly state = inject(EncyclopediaStateService);

  protected readonly testId = ENCYCLOPEDIA_TEST_ID;

  private readonly isSearching = computed(() => this.state.query() !== '');

  protected readonly header = computed(() =>
    this.isSearching()
      ? searchListHeader(this.state.results())
      : categoryListHeader(this.state.location().category, this.state.groups()),
  );

  protected readonly sections = computed(() =>
    this.isSearching() ? searchListSections(this.state.resultGroups()) : categoryListSections(this.state.groups()),
  );

  /** `No match for "xyz"` only while a query is running and matched nothing (§11.5); `null` draws no line at all. */
  protected readonly noMatchText = computed(() =>
    this.isSearching() && this.state.results().length === 0 ? noMatchTextFor(this.state.query()) : null,
  );

  /** The entry being read, so its row stays marked while the detail column shows it; none on a landing. */
  protected readonly selectedId = computed(() => this.state.location().entryId);

  /**
   * A row the reader activated — clicked, or pressed Enter or Space on, the row being read included: its page,
   * **pushed**, so Back returns to wherever they came from.
   */
  protected activate(itemId: string): void {
    const entryId = entryIdFromItemId(itemId, this.sections());
    if (entryId !== null) this.state.openEntry(entryId);
  }

  /**
   * The roving focus, which the kit reports as a selection because selection follows focus here: the entry is shown
   * without being pushed, so arrowing down eighty rows spends no back stack. The selection change that follows an
   * activation lands on the entry that activation has just pushed, and is left alone — replacing it would drop the
   * section an anchor named.
   */
  protected roveTo(itemId: string | null): void {
    const entryId = entryIdFromItemId(itemId, this.sections());
    if (entryId !== null && entryId !== this.state.location().entryId) this.state.focusEntry(entryId);
  }
}
