// The entry page's prose (docs/ui/encyclopedia.md §11.4): `summary`'s segments, at most
// `ENCYCLOPEDIA_PROSE_MAX_WIDTH_PX` wide, in paragraphs. A value segment is the same figure the facts table shows, in
// tabular digits; a link segment is accent text with an underline.
//
// **A link here is an activation** (§11.5): it pushes the location it left, so Back returns to the page the reader
// followed it from. The roving focus of the rail and the list is the only thing that replaces instead — this is not
// that, and the three regressions that seam has already had all came from one of the two cases borrowing the other's
// transition.
//
// **The `prettier-ignore` on the link is load-bearing.** A link is `display: inline` here, so that a phrase of two or
// three words breaks across lines the way the sentence around it does — and inline means the whitespace Angular
// leaves around an interpolation on its own line is not trimmed, so `starts [[stage:endosymbiosis]].` would read
// `starts Endosymbiosis .`. Prettier expands it back because it judges whitespace by a `<button>`'s *default*
// display, which this stylesheet overrides.

import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import { proseParagraphs } from './format/entry-view';
import type { ProseSegment } from './model/entry';
import type { EntryId } from './model/entry-id';
import { PROSE_TOKEN } from './model/prose';
import { encyclopediaLinkTestId } from './test-ids';

@Component({
  selector: 'app-encyclopedia-prose',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './encyclopedia-prose.component.css',
  template: `
    @for (paragraph of paragraphs(); track $index) {
      <p class="paragraph">
        @for (segment of paragraph; track $index) {
          @if (segment.kind === linkKind) {
            <!-- prettier-ignore -->
            <button
              type="button"
              class="link"
              [attr.data-testid]="linkTestId(segment.entryId)"
              (click)="open(segment.entryId, segment.sectionKey)"
            >{{ segment.text }}</button>
          } @else if (segment.kind === valueKind) {
            <span class="value">{{ segment.text }}</span>
          } @else {
            <span>{{ segment.text }}</span>
          }
        }
      </p>
    }
  `,
})
export class EncyclopediaProseComponent {
  private readonly state = inject(EncyclopediaStateService);

  readonly segments = input.required<readonly ProseSegment[]>();

  protected readonly linkKind = PROSE_TOKEN.link;
  protected readonly valueKind = PROSE_TOKEN.value;
  protected readonly linkTestId = encyclopediaLinkTestId;

  protected readonly paragraphs = computed(() => proseParagraphs(this.segments()));

  /** An anchored link (`[[trait:cilia#tier_2]]`) carries its section, which the target page opens at (§11.5). */
  protected open(entryId: EntryId, sectionKey: string | null): void {
    this.state.openEntry(entryId, sectionKey);
  }
}
