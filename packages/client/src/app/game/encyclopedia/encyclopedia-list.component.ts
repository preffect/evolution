// The entry list, and the search results in the same surface (docs/ui/encyclopedia.md §11.3, §11.5): a header naming
// what the column holds and how many, then kit list rows under their section headers.
//
// The two states share one template because `format/list-view.ts` gives them one shape. What differs is only where
// the sections come from: a category's groups, or the search's category runs. The core guarantees
// `resultGroups[0].results[0] === results[0]` for any query, so the row drawn first is the one Enter opens (#449) —
// nothing here re-derives that order.
//
// Every change of selection here is an activation: the kit list does not select as focus moves unless asked to, and
// it is not asked to, so a row reaches `openEntry` only on a click, Enter or Space. #449 turns selection-follows-focus
// on, and at that point it owns telling the two apart, as the rail already does.

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
        (selectedIdChange)="openEntry($event)"
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

  protected openEntry(itemId: string | null): void {
    const entryId = entryIdFromItemId(itemId, this.sections());
    if (entryId !== null) this.state.openEntry(entryId);
  }
}
