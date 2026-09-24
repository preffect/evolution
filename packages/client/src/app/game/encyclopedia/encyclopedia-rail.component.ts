// The category rail (docs/ui/encyclopedia.md §11.3): one kit rail item per category the rail lists, with its 16 px
// mark, its label and its live entry count. Which categories those are is the core's (`listedCategories`, §11.5); an
// empty category is never among them, so the rail never offers a landing with nothing on it.
//
// **Activating pushes, roving replaces** (§11.5), and the kit reports the two apart: `activated` for a click, Enter or
// Space — the row already selected included — and `selectedIdChange` for a move of the selection (ticket #622).
// `activated` fires first, so the push lands before the selection change beside it, and a rove onto the landing that
// is already shown does nothing; nothing here has to track a press.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UiRailComponent } from '../../ui-kit/ui-rail.component';
import { UiRailItemComponent } from '../../ui-kit/ui-rail-item.component';
import { UiScrollAreaComponent } from '../../ui-kit/ui-scroll-area.component';
import { EncyclopediaIconComponent } from './encyclopedia-icon.component';
import { ENCYCLOPEDIA_CATEGORY_ICON } from './encyclopedia-icons';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import { isLandingOf } from './format/navigation';
import { categoryFromItemId, railRowsFor } from './format/rail-view';
import { entryCountIn } from './format/list-view';
import { entriesIn } from './registry';
import { ENCYCLOPEDIA_TEST_ID } from './test-ids';

/** The scroll area's name, since the rail is a column a screen reader may have to scroll on its own. */
const RAIL_LABEL = 'Categories';

@Component({
  selector: 'app-encyclopedia-rail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EncyclopediaIconComponent, UiRailComponent, UiRailItemComponent, UiScrollAreaComponent],
  styleUrl: './encyclopedia-rail.component.css',
  template: `
    <ui-scroll-area class="scroll" [label]="railLabel">
      <ui-rail
        class="rail"
        [attr.aria-label]="railLabel"
        [testId]="testId.rail"
        [selectedId]="selectedId()"
        (activated)="activate($event)"
        (selectedIdChange)="roveTo($event)"
      >
        @for (row of rows(); track row.category) {
          <ui-rail-item [itemId]="row.category" [count]="row.count" [testId]="row.testId">
            <app-encyclopedia-icon uiLeading class="icon" [icon]="categoryIcon[row.category]" />
            {{ row.label }}
          </ui-rail-item>
        }
      </ui-rail>
    </ui-scroll-area>
  `,
})
export class EncyclopediaRailComponent {
  private readonly state = inject(EncyclopediaStateService);

  protected readonly testId = ENCYCLOPEDIA_TEST_ID;
  protected readonly railLabel = RAIL_LABEL;
  protected readonly categoryIcon = ENCYCLOPEDIA_CATEGORY_ICON;

  /** The count is the registry's, read per row rather than typed anywhere (§11.2). */
  protected readonly rows = computed(() =>
    railRowsFor(this.state.categories, (category) => entryCountIn(entriesIn(category))),
  );

  /** While a query is running no category is selected (§11.5): the results replace the category's own list. */
  protected readonly selectedId = computed(() => (this.state.query() === '' ? this.state.location().category : null));

  /**
   * A row activated: its landing, pushed (§11.5) — from an entry of that same category as much as from another one.
   * A query is dropped with it, so the list stops answering a search the rail is no longer part of.
   */
  protected activate(itemId: string): void {
    const category = categoryFromItemId(itemId, this.state.categories);
    if (category === null) return;
    this.state.clearQuery();
    this.state.selectCategory(category);
  }

  /**
   * The roving focus: shows the category without pushing. The selection change that follows an activation lands on
   * the landing that activation has just pushed, and is left alone.
   */
  protected roveTo(itemId: string | null): void {
    const category = categoryFromItemId(itemId, this.state.categories);
    if (category === null || isLandingOf(this.state.location(), category)) return;
    this.state.focusCategory(category);
  }
}
