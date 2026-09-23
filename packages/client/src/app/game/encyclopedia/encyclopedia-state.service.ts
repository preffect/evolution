// The encyclopedia's session state (docs/ui/encyclopedia.md §11.5): where the reader is, the back stack, the query,
// and the entries those answer. Root-provided, so the lobby and the room share one session's reading position and a
// reopen lands where the last close left it.
//
// State only: every transition is a pure function in `format/`, every number is read through
// `EncyclopediaContextService` so a `debug_set_balance` patch re-renders an open page, and nothing here knows how any
// of it is drawn — the panel and its view models are #448's.

import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { EncyclopediaContextService } from './encyclopedia-context';
import {
  canGoBack,
  categoryLanding,
  defaultLocation,
  entryLocation,
  goBack,
  goTo,
  goToReplacing,
  initialNavigation,
  listedCategories,
  type EncyclopediaLocation,
} from './format/navigation';
import {
  groupSearchResults,
  proseText,
  searchEntries,
  type EncyclopediaSearchGroup,
  type EncyclopediaSearchResult,
  type SearchableEntry,
} from './format/search';
import type { EncyclopediaCategory } from './model/categories';
import type { ResolvedEntry, ResolvedGroup } from './model/entry';
import type { EntryId } from './model/entry-id';
import type { FactContext } from './model/fact';
import { entriesIn, resolveEntry } from './registry';

/**
 * The categories the rail lists (§11.5): the registry is assembled once at module load, so which categories are empty
 * is settled once too.
 */
export const LISTED_ENCYCLOPEDIA_CATEGORIES: readonly EncyclopediaCategory[] = listedCategories(
  (category) => entriesIn(category).length > 0,
);

/** Every listed entry as search sees it, in rail order and, inside a category, in list order. */
function searchIndexOf(context: FactContext): readonly SearchableEntry[] {
  return LISTED_ENCYCLOPEDIA_CATEGORIES.flatMap((category) =>
    entriesIn(category).flatMap((group) =>
      group.entries.map((link) => {
        const resolved = resolveEntry(link.entryId, context);
        return { entryId: link.entryId, category, title: resolved.title, summaryText: proseText(resolved.summary) };
      }),
    ),
  );
}

@Injectable({ providedIn: 'root' })
export class EncyclopediaStateService {
  private readonly contextService = inject(EncyclopediaContextService);

  private readonly navigation = signal(initialNavigation(defaultLocation(LISTED_ENCYCLOPEDIA_CATEGORIES)));
  private readonly queryValue = signal('');

  /** The rail's categories, in order; an empty one is never among them. */
  readonly categories = LISTED_ENCYCLOPEDIA_CATEGORIES;

  /** Where the reader is, and where the next open starts (§11.1). */
  readonly location: Signal<EncyclopediaLocation> = computed(() => this.navigation().location);

  /** Back has somewhere to go. */
  readonly canGoBack: Signal<boolean> = computed(() => canGoBack(this.navigation()));

  /** What the search field holds; blank while the list shows its category. */
  readonly query = this.queryValue.asReadonly();

  // The category and the entry are read through their own computeds so that a move which changes only the
  // `sectionKey` — following a `#tier_2` link on the page already open — stops at the string. Depending on
  // `location()` itself would rebuild every `ResolvedGroup` and re-resolve the entry, handing #448's `@for` new
  // identities for a jump that changed nothing about either.
  private readonly currentCategory = computed(() => this.location().category);
  private readonly currentEntryId = computed(() => this.location().entryId);

  /** The current category's non-empty groups with their entries, which the list column walks. */
  readonly groups: Signal<readonly ResolvedGroup[]> = computed(() => entriesIn(this.currentCategory()));

  /** The page being read, resolved against the live balance; `null` on a category landing. */
  readonly entry: Signal<ResolvedEntry | null> = computed(() => {
    const entryId = this.currentEntryId();
    return entryId === null ? null : resolveEntry(entryId, this.contextService.context());
  });

  /** Rebuilt only when the balance behind it changes, not on every keystroke. */
  private readonly searchIndex = computed(() => searchIndexOf(this.contextService.context()));

  /** The matches for the current query, ranked (§11.5); empty while the query is blank. Enter opens the first. */
  readonly results: Signal<readonly EncyclopediaSearchResult[]> = computed(() =>
    searchEntries(this.searchIndex(), this.queryValue()),
  );

  /** The same matches as the sections the list draws them in, one header per category. */
  readonly resultGroups: Signal<readonly EncyclopediaSearchGroup[]> = computed(() =>
    groupSearchResults(this.results()),
  );

  /** A rail row activated: the category's landing, pushed. */
  selectCategory(category: EncyclopediaCategory): void {
    this.navigation.update((navigation) => goTo(navigation, categoryLanding(category)));
  }

  /** A list row, a tile or a link followed (§11.5): the entry's page, pushed, with the rail switched to its category. */
  openEntry(entryId: EntryId, sectionKey: string | null = null): void {
    this.navigation.update((navigation) => goTo(navigation, entryLocation(entryId, sectionKey)));
  }

  /**
   * The rail's roving focus (§11.5), where selection follows focus: shows the category without pushing, so arrowing
   * down the rail does not bury the location Back is meant to return to.
   */
  focusCategory(category: EncyclopediaCategory): void {
    this.navigation.update((navigation) => goToReplacing(navigation, categoryLanding(category)));
  }

  /** The list's roving focus (§11.5): shows the entry without pushing, for the same reason. */
  focusEntry(entryId: EntryId): void {
    this.navigation.update((navigation) => goToReplacing(navigation, entryLocation(entryId)));
  }

  /** Back (§11.5): one move back, never one entry out of a category and never the close. */
  goBack(): void {
    this.navigation.update((navigation) => goBack(navigation));
  }

  setQuery(query: string): void {
    this.queryValue.set(query);
  }

  /** Escape on a non-empty query (§11.5), and the search field's own clear control. */
  clearQuery(): void {
    this.queryValue.set('');
  }

  /**
   * A host opening the panel (§11.1): at `entryId` when the menu asked for one, else at the last location this
   * session. The query never survives a close, so a reopen starts on the list rather than on a stale search.
   */
  openAt(entryId: EntryId | null): void {
    this.clearQuery();
    if (entryId !== null) this.openEntry(entryId);
  }

  /**
   * A host closing the panel (§11.1). The location is the session's reading position and stays; the query does not,
   * so it is dropped from this side too — the invariant then holds whichever door a host used. It still needs a host
   * to use one of them: this service cannot see the overlay state, which is the HUD's in a room and the lobby's
   * outside, so #449's acceptance covers the reopen.
   */
  close(): void {
    this.clearQuery();
  }
}
