// The category rail (docs/ui/encyclopedia.md §11.3): one kit rail item per category the rail lists, with its 16 px
// mark, its label and its live entry count. Which categories those are is the core's (`listedCategories`, §11.5); an
// empty category is never among them, so the rail never offers a landing with nothing on it.
//
// **Activating pushes, roving replaces** (§11.5). The kit's rail selects as focus moves, and reports both the same
// way, so the two are told apart here by what caused the change: a pointer press is an activation and pushes
// (`selectCategory`), and a change with no pointer behind it is the roving focus and replaces (`focusCategory`), so
// arrowing down the rail cannot spend the back stack on looking. `pointerdown` always precedes the `click` the kit
// selects on, which is a DOM ordering rule, not an order between two listeners.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UiRailComponent } from '../../ui-kit/ui-rail.component';
import { UiRailItemComponent } from '../../ui-kit/ui-rail-item.component';
import { UiScrollAreaComponent } from '../../ui-kit/ui-scroll-area.component';
import { EncyclopediaIconComponent } from './encyclopedia-icon.component';
import { ENCYCLOPEDIA_CATEGORY_ICON } from './encyclopedia-icons';
import { EncyclopediaStateService } from './encyclopedia-state.service';
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
        (pointerdown)="noteActivation()"
        (selectedIdChange)="goToCategory($event)"
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

  private isPointerActivation = false;

  protected noteActivation(): void {
    this.isPointerActivation = true;
  }

  protected goToCategory(itemId: string | null): void {
    const wasActivated = this.isPointerActivation;
    this.isPointerActivation = false;
    const category = categoryFromItemId(itemId, this.state.categories);
    if (category === null) return;
    if (wasActivated) this.state.selectCategory(category);
    else this.state.focusCategory(category);
  }
}
