// The encyclopedia's navigation, pure (docs/ui/encyclopedia.md §11.5): where the reader is, the back stack every move
// but Back pushes and Back pops, and which categories the rail may show. `EncyclopediaStateService` holds the result;
// nothing here touches Angular, the DOM or a render concern.
//
// §11.5 writes the location as `{ category, entryId }`. The same bullet asks an anchor (`#tier_2`, `#ahead`) to open
// the page with that section selected, so the location carries `sectionKey` as well; §11.5 is updated to match.

import { DEFAULT_ENCYCLOPEDIA_CATEGORY, ENCYCLOPEDIA_HISTORY_MAX } from '../encyclopedia-constants';
import { ENCYCLOPEDIA_CATEGORY_ORDER, categoryOf, type EncyclopediaCategory } from '../model/categories';
import type { EntryId } from '../model/entry-id';

export interface EncyclopediaLocation {
  readonly category: EncyclopediaCategory;
  /** `null` on a category's landing. */
  readonly entryId: EntryId | null;
  /** The section an anchor named (`tier_2`, `ahead`), `null` for the top of the page. */
  readonly sectionKey: string | null;
}

export interface EncyclopediaNavigation {
  readonly location: EncyclopediaLocation;
  /** Oldest first, so the last element is where Back goes; never longer than `ENCYCLOPEDIA_HISTORY_MAX`. */
  readonly history: readonly EncyclopediaLocation[];
}

/** A category's landing: the rail's own destination. */
export function categoryLanding(category: EncyclopediaCategory): EncyclopediaLocation {
  return { category, entryId: null, sectionKey: null };
}

/** Whether `location` is `category`'s landing itself, not an entry in it. */
export function isLandingOf(location: EncyclopediaLocation, category: EncyclopediaCategory): boolean {
  return location.category === category && location.entryId === null;
}

/** An entry's page. The category comes from the entry, so a link switches the rail to where its target lives. */
export function entryLocation(entryId: EntryId, sectionKey: string | null = null): EncyclopediaLocation {
  return { category: categoryOf(entryId), entryId, sectionKey };
}

/** Two locations show the same thing: a move to one of these pushes nothing (§11.5). */
export function isSameLocation(one: EncyclopediaLocation, other: EncyclopediaLocation): boolean {
  return one.category === other.category && one.entryId === other.entryId && one.sectionKey === other.sectionKey;
}

export function initialNavigation(location: EncyclopediaLocation): EncyclopediaNavigation {
  return { location, history: [] };
}

/** Back has somewhere to go: the header's control is disabled while this is false. */
export function canGoBack(navigation: EncyclopediaNavigation): boolean {
  return navigation.history.length > 0;
}

/** The stack with `location` on top, the oldest entries dropped to keep it within the cap. */
function pushCapped(
  history: readonly EncyclopediaLocation[],
  location: EncyclopediaLocation,
): readonly EncyclopediaLocation[] {
  const dropCount = Math.max(0, history.length - ENCYCLOPEDIA_HISTORY_MAX + 1);
  return [...history.slice(dropCount), location];
}

/**
 * Every move but Back (§11.5): the location being left is pushed, and a move to the location already shown changes
 * nothing at all — not even the stack.
 */
export function goTo(navigation: EncyclopediaNavigation, location: EncyclopediaLocation): EncyclopediaNavigation {
  if (isSameLocation(navigation.location, location)) return navigation;
  return { location, history: pushCapped(navigation.history, navigation.location) };
}

/**
 * A move that replaces where the reader is instead of pushing it: the rail's and the list's roving focus, where
 * selection follows focus (§11.5). Arrowing through a list is one continuous act of looking, not fifty moves — pushing
 * each one would spend `ENCYCLOPEDIA_HISTORY_MAX` on arrow steps and drop the location the reader actually came from,
 * leaving Back unable to return there. Activating a row, a tile, a link or a crumb pushes; roving replaces.
 */
export function goToReplacing(
  navigation: EncyclopediaNavigation,
  location: EncyclopediaLocation,
): EncyclopediaNavigation {
  if (isSameLocation(navigation.location, location)) return navigation;
  return { ...navigation, location };
}

/** Back pops (§11.5). With nothing pushed there is nowhere to go, and the navigation is returned untouched. */
export function goBack(navigation: EncyclopediaNavigation): EncyclopediaNavigation {
  const previous = navigation.history[navigation.history.length - 1];
  if (previous === undefined) return navigation;
  return { location: previous, history: navigation.history.slice(0, -1) };
}

/**
 * The categories the rail shows (§11.5): the declared order minus every category with no entry, so an empty category
 * is never offered. `hasEntries` is the registry's `entriesIn(category)` in the running game.
 */
export function listedCategories(
  hasEntries: (category: EncyclopediaCategory) => boolean,
): readonly EncyclopediaCategory[] {
  return ENCYCLOPEDIA_CATEGORY_ORDER.filter((category) => hasEntries(category));
}

/**
 * Where an open with no entry asked for and no last location starts (§11.1): the default category's landing whenever
 * the rail lists it — wherever in the order it sits — or else the first one the rail does list, since the landing
 * shown must have entries. The `??` arm is the impossible case: `listed` is empty only for an empty registry, which
 * `registry-completeness.spec.ts` forbids.
 */
export function defaultLocation(listed: readonly EncyclopediaCategory[]): EncyclopediaLocation {
  if (listed.includes(DEFAULT_ENCYCLOPEDIA_CATEGORY)) return categoryLanding(DEFAULT_ENCYCLOPEDIA_CATEGORY);
  return categoryLanding(listed[0] ?? DEFAULT_ENCYCLOPEDIA_CATEGORY);
}
