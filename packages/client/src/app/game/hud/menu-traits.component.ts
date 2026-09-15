// The menu's `Your traits` section (docs/ui/overlays.md §3.5): a panel-rim rule, `YOUR TRAITS` with the owned count,
// then one kit list row per owned trait — its glyph, `Cilia Fringe II`, and the effect lines joined with `·`, broken
// only between two effects and never cut, so a row grows a line at a time; a trailing `›`. The list is one Tab stop
// with ↑ ↓ between rows, and a row opens the trait's encyclopedia entry. Past `MENU_TRAITS_VISIBLE_ROWS` it scrolls.

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { UiListRowComponent } from '../../ui-kit/ui-list-row.component';
import { UiListComponent } from '../../ui-kit/ui-list.component';
import { UiScrollAreaComponent } from '../../ui-kit/ui-scroll-area.component';
import { TraitGlyphComponent } from '../glyphs/trait-glyph.component';
import type { MenuTraitRow } from './format/menu-traits';
import { HUD_TEST_ID, menuTraitTestId } from './test-ids';

@Component({
  selector: 'app-menu-traits',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TraitGlyphComponent, UiListComponent, UiListRowComponent, UiScrollAreaComponent],
  styleUrl: './menu-traits.component.css',
  template: `
    <h3 class="heading">
      <span>Your traits</span>
      <span class="count">{{ rows().length }}</span>
    </h3>
    @if (rows().length === 0) {
      <p class="empty">No traits yet</p>
    } @else {
      <ui-scroll-area class="scroll" label="Your traits">
        <ui-list aria-label="Your traits" [testId]="testId.menuTraits" (selectedIdChange)="open($event)">
          @for (row of rows(); track row.traitId) {
            <ui-list-row class="row" [itemId]="row.traitId" [testId]="rowTestId(row)">
              <app-trait-glyph uiLeading class="glyph" lod="list" still [traitId]="row.traitId" />
              <span class="text">
                <span class="name">{{ row.name }}</span>
                @if (row.effects.length > 0) {
                  <span class="effects">
                    <span class="effect-list">
                      @for (effect of row.effects; track $index) {
                        <span class="effect">{{ effect }}</span>
                      }
                    </span>
                  </span>
                }
              </span>
              <span uiTrailing class="chevron" aria-hidden="true">›</span>
            </ui-list-row>
          }
        </ui-list>
      </ui-scroll-area>
    }
  `,
})
export class MenuTraitsComponent {
  readonly rows = input.required<readonly MenuTraitRow[]>();
  /** A row activated (click, Enter, Space): the menu opens its encyclopedia entry. */
  readonly opened = output<MenuTraitRow>();

  protected readonly testId = HUD_TEST_ID;

  private readonly rowsById = computed(() => new Map(this.rows().map((row) => [row.traitId as string, row])));

  protected rowTestId(row: MenuTraitRow): string {
    return menuTraitTestId(row.traitId);
  }

  protected open(traitId: string | null): void {
    const row = traitId === null ? undefined : this.rowsById().get(traitId);
    if (row !== undefined) this.opened.emit(row);
  }
}
