// The category landing (docs/ui/encyclopedia.md §11.3): the breadcrumb, the category's label and its one-line
// summary, then a tile per entry. The reference frame is `qa/decisions/encyclopedia/encyclopedia-a-category-*.png`,
// which layout B shares (decision #368).
//
// A tile is a link to its entry: a button, named for a screen reader by the entry's full title, because the title on
// its face is cut with an ellipsis when it does not fit. Build 1 draws a glyph medallion in the well; the still frame
// of the real render is #378.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UiScrollAreaComponent } from '../../ui-kit/ui-scroll-area.component';
import { GLYPH_LOD } from '../glyphs/glyph-view';
import { EncyclopediaBreadcrumbComponent } from './encyclopedia-breadcrumb.component';
import { EncyclopediaContextService } from './encyclopedia-context';
import { EncyclopediaGlyphComponent } from './encyclopedia-glyph.component';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import { landingBreadcrumb, landingTilesFor } from './format/landing-view';
import { ENCYCLOPEDIA_CATEGORY_LABEL, ENCYCLOPEDIA_CATEGORY_SUMMARY } from './model/categories';
import type { EntryId } from './model/entry-id';
import { resolveEntry } from './registry';

@Component({
  selector: 'app-encyclopedia-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EncyclopediaBreadcrumbComponent, EncyclopediaGlyphComponent, UiScrollAreaComponent],
  styleUrl: './encyclopedia-landing.component.css',
  template: `
    <ui-scroll-area class="scroll" [label]="label()">
      <div class="landing">
        <app-encyclopedia-breadcrumb [crumbs]="crumbs()" />
        <h3 class="headline">{{ label() }}</h3>
        <p class="summary">{{ summary() }}</p>
        <div class="tiles">
          @for (tile of tiles(); track tile.entryId) {
            <button
              type="button"
              class="tile"
              [attr.aria-label]="tile.title"
              [attr.data-testid]="tile.testId"
              (click)="open(tile.entryId)"
            >
              <span class="well">
                <app-encyclopedia-glyph class="glyph" [entryId]="tile.entryId" [lod]="cardLod" />
              </span>
              <span class="caption">
                <span class="title">{{ tile.title }}</span>
                @if (tile.fact; as fact) {
                  <span class="fact">{{ fact }}</span>
                }
              </span>
            </button>
          }
        </div>
      </div>
    </ui-scroll-area>
  `,
})
export class EncyclopediaLandingComponent {
  private readonly state = inject(EncyclopediaStateService);
  private readonly contextService = inject(EncyclopediaContextService);

  protected readonly cardLod = GLYPH_LOD.card;

  private readonly category = computed(() => this.state.location().category);

  protected readonly label = computed(() => ENCYCLOPEDIA_CATEGORY_LABEL[this.category()]);
  protected readonly summary = computed(() => ENCYCLOPEDIA_CATEGORY_SUMMARY[this.category()]);
  protected readonly crumbs = computed(() => landingBreadcrumb(this.category()));

  /** Resolved against the live balance, so a `debug_set_balance` patch changes a tile's fact with the page open. */
  protected readonly tiles = computed(() =>
    landingTilesFor(this.state.groups(), (entryId) => resolveEntry(entryId, this.contextService.context())),
  );

  protected open(entryId: EntryId): void {
    this.state.openEntry(entryId);
  }
}
