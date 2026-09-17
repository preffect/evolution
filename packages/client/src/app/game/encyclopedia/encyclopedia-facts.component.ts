// One facts table of the entry page (docs/ui/encyclopedia.md §11.4): a `label` header over a kit facts table. Both of
// the page's tables are this component — the trait's Effects by tier, which has tier columns and may tint one, and
// the Unlock and ladder table, whose values may be links.
//
// The kit draws a value that is more than text through `ng-template[uiFactValue]`, whose context types its row as the
// kit's own `UiFactRow`. The links belong to the feature's row, so they are looked up by `rowId` rather than read off
// a cast: the tables are a handful of rows each, and a lookup keeps the template free of a type assertion.
//
// **The `prettier-ignore` on the link is load-bearing.** Angular collapses the whitespace around an interpolation to
// one space rather than dropping it, so a `{{ link.title }}` on its own line makes the row read `Requires` `Cilia
// Fringe , Protocell`. Prettier reformats it back every time it is written tight, because a `<button>` is
// `inline-block` and prettier judges whitespace by CSS display — true of the browser, and not of the DOM text a spec
// reads. Pinning the format keeps the text and the frame saying the same thing.

import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { UiFactValueDirective, UiFactsTableComponent, type UiFactRow } from '../../ui-kit/ui-facts-table.component';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import { FACT_LIST_SEPARATOR } from './facts/resolve-prose';
import type { EncyclopediaFactRow } from './format/entry-view';
import type { EntryId } from './model/entry-id';
import { ENCYCLOPEDIA_TEST_ID, encyclopediaLinkTestId } from './test-ids';

const NO_LINKS: EncyclopediaFactRow['links'] = [];

@Component({
  selector: 'app-encyclopedia-facts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiFactValueDirective, UiFactsTableComponent],
  styleUrl: './encyclopedia-facts.component.css',
  template: `
    <h4 class="heading">{{ heading() }}</h4>
    <ui-facts-table
      [rows]="rows()"
      [columns]="columns()"
      [columnsCaption]="columnsCaption()"
      [highlightColumn]="highlightColumn()"
      [testId]="testId.facts"
    >
      <ng-template uiFactValue let-row let-value="value">
        @if (linksOf(row); as links) {
          @if (links.length === 0) {
            {{ value }}
          } @else {
            @for (link of links; track link.entryId; let isLast = $last) {
              <!-- prettier-ignore -->
              <button
                type="button"
                class="link"
                [attr.data-testid]="linkTestId(link.entryId)"
                (click)="open(link.entryId)"
              >{{ link.title }}</button>
              @if (!isLast) {
                <span class="separator">{{ listSeparator }}</span>
              }
            }
          }
        }
      </ng-template>
    </ui-facts-table>
  `,
})
export class EncyclopediaFactsComponent {
  private readonly state = inject(EncyclopediaStateService);

  readonly heading = input.required<string>();
  readonly rows = input.required<readonly EncyclopediaFactRow[]>();
  /** The tier numerals of the Effects by tier table; none draws no header row (§10.2). */
  readonly columns = input<readonly string[]>([]);
  readonly columnsCaption = input('');
  readonly highlightColumn = input<number | null>(null);

  protected readonly testId = ENCYCLOPEDIA_TEST_ID;
  protected readonly linkTestId = encyclopediaLinkTestId;
  protected readonly listSeparator = FACT_LIST_SEPARATOR;

  /** The feature's links for the row the kit is drawing; empty for a plain value, which the kit's text renders. */
  protected linksOf(row: UiFactRow): EncyclopediaFactRow['links'] {
    return this.rows().find((candidate) => candidate.rowId === row.rowId)?.links ?? NO_LINKS;
  }

  /** A fact's link is an activation, so it pushes the location it left and Back returns here (§11.5). */
  protected open(entryId: EntryId): void {
    this.state.openEntry(entryId);
  }
}
