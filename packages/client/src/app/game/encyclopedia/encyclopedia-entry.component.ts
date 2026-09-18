// The entry page (docs/ui/encyclopedia.md §11.4), layout B: a content column holding the lens column and the title
// column side by side, with the prose and See also running across both below them.
//
// **The lens column is the page's, the session is the panel's.** This page says *what* to preview — the entry's own
// spec, or the tier the switch under the lens is on — and hands it to `EncyclopediaPreviewService`; the lens draws
// whatever state that service is in. So turning a page swaps a scene rather than opening a preview (§12.7).

import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal } from '@angular/core';
import { FIRST_TIER, type OwnedTrait, type TraitTier } from '@evolution/shared';
import { UiChipComponent, UiLinkChipComponent } from '../../ui-kit/ui-chip.component';
import { UiScrollAreaComponent } from '../../ui-kit/ui-scroll-area.component';
import { GameStateService } from '../state/game-state.service';
import { EncyclopediaBreadcrumbComponent } from './encyclopedia-breadcrumb.component';
import { EncyclopediaFactsComponent } from './encyclopedia-facts.component';
import { EncyclopediaLensComponent } from './encyclopedia-lens.component';
import { EncyclopediaLensControlComponent } from './encyclopedia-lens-control.component';
import { EncyclopediaPreviewService } from './encyclopedia-preview.service';
import { EncyclopediaProseComponent } from './encyclopedia-prose.component';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import {
  ENCYCLOPEDIA_EFFECTS_TABLE_LABEL,
  ENCYCLOPEDIA_FACTS_TABLE_LABEL,
  ENCYCLOPEDIA_LADDER_TABLE_LABEL,
  ENCYCLOPEDIA_SEE_ALSO_LABEL,
} from './encyclopedia-constants';
import { entryBreadcrumb } from './format/landing-view';
import {
  entryChips,
  factRowsFor,
  ownedTierOf,
  tierSwitchFor,
  tierTableFor,
  type EncyclopediaTierSwitch,
} from './format/entry-view';
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
    EncyclopediaLensComponent,
    EncyclopediaLensControlComponent,
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
                <app-encyclopedia-lens [state]="previewState()" />
                @if (tierSwitch(); as control) {
                  <app-encyclopedia-lens-control
                    [segments]="control.segments"
                    [selectedTier]="selectedTier()"
                    (tierSelected)="selectTier($event)"
                  />
                }
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
  private readonly preview = inject(EncyclopediaPreviewService);

  readonly entry = input.required<ResolvedEntry>();

  protected readonly testId = ENCYCLOPEDIA_TEST_ID;
  /** What the lens draws; the session behind it is the panel's, and outlives this page (§12.7). */
  protected readonly previewState = this.preview.state;
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

  /** The lens control, `null` for every entry that is not a trait: only a trait has tiers to switch between. */
  protected readonly tierSwitch = computed(() => tierSwitchFor(this.entry().sections, this.ownedTier()));

  /**
   * The tier the switch is on. It follows the reader's choice while they stay on the page, and goes back to the
   * default — the owned tier in a round, else the first — whenever the page or the owned tier changes, which is
   * exactly when `tierSwitch` is rebuilt. The fallback is never drawn: a page with no switch shows no segment.
   */
  protected readonly selectedTier = linkedSignal<EncyclopediaTierSwitch | null, TraitTier>({
    source: this.tierSwitch,
    computation: (control) => control?.defaultTier ?? FIRST_TIER,
  });

  /**
   * What the lens shows: the selected tier's own preview, or the entry's where a section re-points none. Both are
   * the registry's objects rather than fresh ones, so this signal changes identity only when the reader moves —
   * which is what keeps a page rebuilt by a snapshot from restarting the scene (`encyclopedia-preview.service.ts`).
   */
  private readonly previewSpec = computed(() => {
    const segment = this.tierSwitch()?.segments.find((one) => one.tier === this.selectedTier());
    return segment?.preview ?? this.entry().preview;
  });

  constructor() {
    effect(() => {
      const spec = this.previewSpec();
      if (spec !== null) this.preview.show(spec);
    });
  }

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

  /** The tier switch under the lens: the effect above carries the choice to the preview. */
  protected selectTier(tier: TraitTier): void {
    this.selectedTier.set(tier);
  }
}
