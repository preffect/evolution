// The menu's `Your traits` section (docs/ui/overlays.md §3.5): a panel-rim rule, `YOUR TRAITS` with the owned count,
// then one kit list row per owned trait — its glyph, `Cilia Fringe II`, and the effect lines joined with `·`, broken
// only between two effects and never cut, so a row grows a line at a time; a trailing `›`. The list is one Tab stop
// with ↑ ↓ between rows, and a row opens the trait's encyclopedia entry. Past `MENU_TRAITS_VISIBLE_ROWS` it scrolls.

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { observeElementSize } from '../../ui-kit/element-size';
import { UiEffectMarkComponent } from '../../ui-kit/ui-effect-mark.component';
import { UiListRowComponent } from '../../ui-kit/ui-list-row.component';
import { UiListComponent } from '../../ui-kit/ui-list.component';
import { UiScrollAreaComponent } from '../../ui-kit/ui-scroll-area.component';
import { TraitGlyphComponent } from '../glyphs/trait-glyph.component';
import { visibleRowsHeightPx, type MenuTraitRow } from './format/menu-traits';
import { MENU_TRAITS_VISIBLE_ROWS } from './hud-constants';
import { HUD_TEST_ID, menuTraitTestId } from '../test-ids/hud-test-ids';

@Component({
  selector: 'app-menu-traits',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TraitGlyphComponent, UiEffectMarkComponent, UiListComponent, UiListRowComponent, UiScrollAreaComponent],
  styleUrl: './menu-traits.component.css',
  template: `
    <h3 class="heading">
      <span>Your traits</span>
      <span class="count">{{ rows().length }}</span>
    </h3>
    @if (rows().length === 0) {
      <p class="empty">No traits yet</p>
    } @else {
      <ui-scroll-area class="scroll" label="Your traits" [style.max-height.px]="maxHeightPx()">
        <ui-list #list aria-label="Your traits" [testId]="testId.menuTraits" (selectedIdChange)="open($event)">
          @for (row of rows(); track row.traitId) {
            <ui-list-row class="row" [itemId]="row.traitId" [testId]="rowTestId(row)">
              <app-trait-glyph uiLeading class="glyph" lod="list" still [traitId]="row.traitId" />
              <span class="text">
                <span class="name">{{ row.name }}</span>
                @if (row.effects.length > 0) {
                  <span class="effects">
                    <span class="effect-list">
                      @for (effect of row.effects; track $index) {
                        <span class="effect"
                          ><ui-effect-mark [effect]="row.effectTones[$index] ?? null" />{{ effect }}</span
                        >
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

  // `read: ElementRef`, since `#list` sits on a component: without it the query answers the `ui-list` instance.
  private readonly listElement = viewChild('list', { read: ElementRef });
  private readonly maxHeight = signal<number | null>(null);

  /**
   * What the scroll area is capped at, in real px: the first `MENU_TRAITS_VISIBLE_ROWS` rows as drawn, or `null`
   * while the list fits. Measured rather than multiplied out, since a row grows with each effect line (§3.5).
   */
  protected readonly maxHeightPx = this.maxHeight.asReadonly();

  private readonly rowsById = computed(() => new Map(this.rows().map((row) => [row.traitId as string, row])));

  constructor() {
    // The rows resize when they arrive, when an effect line wraps and when the UI scale changes; each is a resize
    // of the list itself, so one observer covers every case and no render pass measures on its own.
    effect((onCleanup) => {
      const list = this.listElement()?.nativeElement;
      if (list === undefined) {
        this.maxHeight.set(null);
        return;
      }
      onCleanup(observeElementSize(list, () => this.measure()));
    });
  }

  /** Re-reads the drawn row heights and caps the list; the resize observer calls it, and a spec can. */
  measure(): void {
    const list = this.listElement()?.nativeElement;
    const rowHeights = list === undefined ? [] : [...list.children].map((row) => (row as HTMLElement).offsetHeight);
    this.maxHeight.set(visibleRowsHeightPx(rowHeights, MENU_TRAITS_VISIBLE_ROWS));
  }

  protected rowTestId(row: MenuTraitRow): string {
    return menuTraitTestId(row.traitId);
  }

  protected open(traitId: string | null): void {
    const row = traitId === null ? undefined : this.rowsById().get(traitId);
    if (row !== undefined) this.opened.emit(row);
  }
}
