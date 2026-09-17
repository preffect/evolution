// The category rail (docs/ui/encyclopedia.md §11.3): one kit rail item per category the rail lists, with its 16 px
// mark, its label and its live entry count. Which categories those are is the core's (`listedCategories`, §11.5); an
// empty category is never among them, so the rail never offers a landing with nothing on it.
//
// **Activating pushes, roving replaces** (§11.5), and the kit reports both the same way — but only *sometimes*.
// `UiRovingGroup.select` writes a signal, so pressing the row that is already selected sets the value it already
// holds and emits nothing at all. Two things follow, and they are why an activation is handled on its own event
// rather than on the kit's report:
//
//   * **An activation is one whether or not the selection moves.** Reading `trait:mitochondrion` and pressing
//     `Evolution` must return to that category's landing (§11.5, "selecting a category shows its landing"), and with
//     one category listed today the rail would otherwise be an inert control for the whole build. So each item's own
//     `(click)`, and its Enter or Space, push the category that item names — no id to narrow, no emission to wait for.
//   * **The report is then the roving focus and nothing else** — except during an activation, where the kit may also
//     emit. `EncyclopediaActivationPressDirective` suppresses that one; its file is where the whole trap is written
//     down, including why the flag ends on `document` rather than on this element.
//
// Nothing here assumes an order between two listeners on one element: whichever of the item's `(click)` and the
// kit's own runs first, the push happens once and the replace beside it is a no-op on the location already shown.
// (The kit's does in fact run first — #460's review measured it — but the code does not rely on that.)

import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { isRovingSelectKey } from '../../ui-kit/roving-group';
import { UiRailComponent } from '../../ui-kit/ui-rail.component';
import { UiRailItemComponent } from '../../ui-kit/ui-rail-item.component';
import { UiScrollAreaComponent } from '../../ui-kit/ui-scroll-area.component';
import { EncyclopediaActivationPressDirective } from './encyclopedia-activation-press.directive';
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
  imports: [
    EncyclopediaActivationPressDirective,
    EncyclopediaIconComponent,
    UiRailComponent,
    UiRailItemComponent,
    UiScrollAreaComponent,
  ],
  styleUrl: './encyclopedia-rail.component.css',
  template: `
    <ui-scroll-area class="scroll" [label]="railLabel">
      <ui-rail
        class="rail"
        encyclopediaActivationPress
        [attr.aria-label]="railLabel"
        [testId]="testId.rail"
        [selectedId]="selectedId()"
        (selectedIdChange)="roveTo($event)"
      >
        @for (row of rows(); track row.category) {
          <ui-rail-item
            [itemId]="row.category"
            [count]="row.count"
            [testId]="row.testId"
            (click)="activate(row.category)"
            (keydown)="activateOnSelectKey($event, row.category)"
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

  private readonly activationPress = viewChild.required(EncyclopediaActivationPressDirective);

  /**
   * A row activated: its landing, pushed (§11.5) — from an entry of that same category as much as from another one.
   * A query is dropped with it, so the list stops answering a search the rail is no longer part of. The flag is set
   * here as well as by the group's `(pointerdown)`, because Enter and Space reach this with no pointer press at all.
   */
  protected activate(category: EncyclopediaCategory): void {
    this.activationPress().begin();
    this.state.clearQuery();
    this.state.selectCategory(category);
  }

  /**
   * Enter or Space on a focused row is an activation, not the rove that put focus there. It is bound on the **item**
   * so that it runs before the kit's own handler on the group above it, which is the only ordering the DOM guarantees.
   */
  protected activateOnSelectKey(event: KeyboardEvent, category: EncyclopediaCategory): void {
    if (isRovingSelectKey(event.key)) this.activate(category);
  }

  /** The roving focus: shows the category without pushing. An activation's own report is handled above. */
  protected roveTo(itemId: string | null): void {
    if (this.activationPress().isInFlight) return;
    const category = categoryFromItemId(itemId, this.state.categories);
    if (category !== null) this.state.focusCategory(category);
  }
}
