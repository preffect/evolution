// The entry page (docs/ui/encyclopedia.md §11.4), layout B: a content column holding the lens column and the title
// column side by side, with the prose and See also running across both below them.
//
// **The lens column is reserved, not built.** Ticket #466 puts the live preview in it once the preview seam (#363)
// exists; until then the box holds the eyepiece's own well and rim at `ENCYCLOPEDIA_LENS_DIAMETER_PX`, so the page it
// drops into is already laid out and the space reads as an instrument waiting for a slide rather than as a hole. It
// carries no `encyclopedia-preview` id: there is no preview here to have a state.

import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { OwnedTrait } from '@evolution/shared';
import { UiChipComponent, UiLinkChipComponent } from '../../ui-kit/ui-chip.component';
import { UiScrollAreaComponent } from '../../ui-kit/ui-scroll-area.component';
import { GameStateService } from '../state/game-state.service';
import { EncyclopediaBreadcrumbComponent } from './encyclopedia-breadcrumb.component';
import { EncyclopediaFactsComponent } from './encyclopedia-facts.component';
import { EncyclopediaProseComponent } from './encyclopedia-prose.component';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import {
  ENCYCLOPEDIA_EFFECTS_TABLE_LABEL,
  ENCYCLOPEDIA_FACTS_TABLE_LABEL,
  ENCYCLOPEDIA_LADDER_TABLE_LABEL,
  ENCYCLOPEDIA_SEE_ALSO_LABEL,
} from './encyclopedia-constants';
import { entryBreadcrumb } from './format/landing-view';
import { entryChips, factRowsFor, ownedTierOf, tierTableFor } from './format/entry-view';
import type { ResolvedEntry } from './model/entry';
import { ENTRY_SUBJECT, type EntryId } from './model/entry-id';
import { ENTRY_GROUP_LABEL } from './model/groups';
import { ENCYCLOPEDIA_TEST_ID, encyclopediaLinkTestId } from './test-ids';
import { entryTitle } from './registry';

/** One array rather than a fresh one per read, so the owned-tier computed does not rebuild on every snapshot. */
const NO_OWNED_TRAITS: readonly OwnedTrait[] = [];

@Component({
  selector: 'app-encyclopedia-entry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EncyclopediaBreadcrumbComponent,
    EncyclopediaFactsComponent,
    EncyclopediaProseComponent,
    UiChipComponent,
    UiLinkChipComponent,
    UiScrollAreaComponent,
  ],
  styleUrl: './encyclopedia-entry.component.css',
  host: { '[attr.data-testid]': 'testId.entry', '[attr.data-entry-id]': 'entry().id' },
  template: `
    <ui-scroll-area class="scroll" [label]="entry().title">
      <div class="page">
        <div class="content">
          <div class="top">
            @if (entry().preview) {
              <div class="lens-column">
                <div class="lens-reserved" aria-hidden="true"></div>
              </div>
            }
            <div class="title-column">
              <app-encyclopedia-breadcrumb [crumbs]="crumbs()" />
              <h3 class="title">{{ entry().title }}</h3>
              <div class="chips">
                @for (chip of chips(); track chip.key) {
                  <ui-chip [tone]="chip.tone" [dotColour]="chip.dotColour">{{ chip.text }}</ui-chip>
                }
              </div>
              @if (tierTable(); as table) {
                <app-encyclopedia-facts
                  class="table"
                  [heading]="effectsLabel"
                  [rows]="table.rows"
                  [columns]="table.columns"
                  [columnsCaption]="table.caption"
                  [highlightColumn]="table.highlightColumn"
                />
              }
              @if (factRows().length > 0) {
                <app-encyclopedia-facts class="table" [heading]="factsLabel()" [rows]="factRows()" />
              }
            </div>
          </div>

          <app-encyclopedia-prose class="prose" [segments]="entry().summary" />

          @if (entry().seeAlso.length > 0) {
            <section class="see-also">
              <h4 class="heading">{{ seeAlsoLabel }}</h4>
              <div class="chips">
                @for (link of entry().seeAlso; track link.entryId) {
                  <button type="button" uiLinkChip [testId]="linkTestId(link.entryId)" (click)="open(link.entryId)">
                    {{ link.title }}
                  </button>
                }
              </div>
            </section>
          }
        </div>
      </div>
    </ui-scroll-area>
  `,
})
export class EncyclopediaEntryComponent {
  private readonly state = inject(EncyclopediaStateService);
  private readonly gameState = inject(GameStateService);

  readonly entry = input.required<ResolvedEntry>();

  protected readonly testId = ENCYCLOPEDIA_TEST_ID;
  protected readonly linkTestId = encyclopediaLinkTestId;
  protected readonly effectsLabel = ENCYCLOPEDIA_EFFECTS_TABLE_LABEL;
  protected readonly seeAlsoLabel = ENCYCLOPEDIA_SEE_ALSO_LABEL;

  /** The first crumb is a link back to the category the entry lives in, which a link may have switched (§11.5). */
  protected readonly crumbs = computed(() => {
    const group = this.entry().group;
    return entryBreadcrumb(this.entry().category, group === null ? null : ENTRY_GROUP_LABEL[group]);
  });

  /**
   * The tier a round has of the trait this page documents, which tints a column and adds the gold chip (§11.4). It is
   * the progress record's rather than the live cell's: the two agree while alive, and the record is what survives a
   * death, so a page read from the respawn overlay still says what the reader owns.
   */
  private readonly ownedTier = computed(() =>
    ownedTierOf(this.gameState.ownProgress()?.ownedTraits ?? NO_OWNED_TRAITS, this.entry().subject),
  );

  protected readonly chips = computed(() => entryChips(this.entry().subject, this.ownedTier(), entryTitle));
  protected readonly tierTable = computed(() => tierTableFor(this.entry().sections, this.ownedTier()));
  protected readonly factRows = computed(() => factRowsFor(this.entry().facts));

  /** §11.4 names the header of a trait's second table; every other entry has one table, and it is simply its facts. */
  protected readonly factsLabel = computed(() =>
    this.entry().subject.kind === ENTRY_SUBJECT.trait
      ? ENCYCLOPEDIA_LADDER_TABLE_LABEL
      : ENCYCLOPEDIA_FACTS_TABLE_LABEL,
  );

  /** A See also chip is an activation, so it pushes and Back returns to this page (§11.5). */
  protected open(entryId: EntryId): void {
    this.state.openEntry(entryId);
  }
}
