// The category rail (docs/ui/encyclopedia.md §11.3): one kit rail item per category the rail lists, with its 16 px
// mark, its label and its live entry count. Which categories those are is the core's (`listedCategories`, §11.5); an
// empty category is never among them, so the rail never offers a landing with nothing on it.
//
// **Activating pushes, roving replaces** (§11.5), and the kit reports both the same way — but only *sometimes*.
// `UiRovingGroup.select` writes a signal, so pressing the row that is already selected sets the value it already
// holds and emits nothing at all. Two things follow, and they are why the press is handled on its own event rather
// than on the kit's report:
//
//   * **A press is an activation whether or not the selection moves.** Reading `trait:mitochondrion` and pressing
//     `Evolution` must return to that category's landing (§11.5, "selecting a category shows its landing"), and with
//     one category listed today the rail would otherwise be an inert control for the whole build. So each item's own
//     `(click)` pushes, with the category it names — no id to narrow, no emission to wait for.
//   * **The report is then the roving focus and nothing else** — except during a press, where the kit may also emit.
//     `isPointerPressInFlight` suppresses that one, since the press's own push is the move and a replace either side
//     of it would either be a duplicate or swallow the location Back is there to return to. The flag is set on
//     `pointerdown` and cleared when the press *ends*: on the `click` it bubbles (which a press on the already
//     selected row, or on the strip above the first row, still produces) or on the pointer leaving the rail without
//     producing one. It cannot survive into the next keyboard move, which is the latch #460's review found.
//
// Neither handler assumes an order between two listeners on one element: whichever of the item's `(click)` and the
// kit's own runs first, the push happens once and the replace beside it is a no-op on the location already shown.
// Enter and Space are still the kit's `select`, so they emit nothing on a rail whose selection follows focus; the
// keyboard model, including what Enter does here, is #449's.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UiRailComponent } from '../../ui-kit/ui-rail.component';
import { UiRailItemComponent } from '../../ui-kit/ui-rail-item.component';
import { UiScrollAreaComponent } from '../../ui-kit/ui-scroll-area.component';
import { EncyclopediaIconComponent } from './encyclopedia-icon.component';
import { ENCYCLOPEDIA_CATEGORY_ICON } from './encyclopedia-icons';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import { categoryFromItemId, railRowsFor } from './format/rail-view';
import { entryCountIn } from './format/list-view';
import type { EncyclopediaCategory } from './model/categories';
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
        (pointerdown)="beginPointerPress()"
        (pointerleave)="endPointerPress()"
        (click)="endPointerPress()"
        (selectedIdChange)="roveTo($event)"
      >
        @for (row of rows(); track row.category) {
          <ui-rail-item
            [itemId]="row.category"
            [count]="row.count"
            [testId]="row.testId"
            (click)="activate(row.category)"
          >
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

  private isPointerPressInFlight = false;

  protected beginPointerPress(): void {
    this.isPointerPressInFlight = true;
  }

  protected endPointerPress(): void {
    this.isPointerPressInFlight = false;
  }

  /**
   * A row pressed: its landing, pushed (§11.5) — from an entry of that same category as much as from another one.
   * A query is dropped with it, so the list stops answering a search the rail is no longer part of.
   */
  protected activate(category: EncyclopediaCategory): void {
    this.state.clearQuery();
    this.state.selectCategory(category);
  }

  /** The roving focus: shows the category without pushing. A press's own report is the press's, handled above. */
  protected roveTo(itemId: string | null): void {
    if (this.isPointerPressInFlight) return;
    const category = categoryFromItemId(itemId, this.state.categories);
    if (category !== null) this.state.focusCategory(category);
  }
}
