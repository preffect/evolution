// The category rail's view model, pure (docs/ui/encyclopedia.md §11.3): one row per category the rail lists, with the
// label, the live entry count and the row's test id. Which categories are listed is the core's `listedCategories`
// (§11.5) — this file never decides that, it only draws the answer.

import { ENCYCLOPEDIA_CATEGORY_LABEL, type EncyclopediaCategory } from '../model/categories';
import { encyclopediaCategoryTestId } from '../test-ids';

export interface EncyclopediaRailRow {
  readonly category: EncyclopediaCategory;
  readonly label: string;
  /** `entriesIn(category)`'s length, never a typed number (§11.2). */
  readonly count: number;
  readonly testId: string;
}

/**
 * One row per listed category, in the order given. `countIn` is the registry's count for that category, passed in so
 * this file stays pure and a spec can count whatever it likes.
 */
export function railRowsFor(
  categories: readonly EncyclopediaCategory[],
  countIn: (category: EncyclopediaCategory) => number,
): readonly EncyclopediaRailRow[] {
  return categories.map((category) => ({
    category,
    label: ENCYCLOPEDIA_CATEGORY_LABEL[category],
    count: countIn(category),
    testId: encyclopediaCategoryTestId(category),
  }));
}

/**
 * The category a rail item's `itemId` names, or `null` for anything else. The kit hands its selection back as the
 * opaque string the feature put in, so it is narrowed here rather than cast at the call site: a row id that is not a
 * listed category moves the reader nowhere instead of navigating to a category that does not exist.
 */
export function categoryFromItemId(
  itemId: string | null,
  categories: readonly EncyclopediaCategory[],
): EncyclopediaCategory | null {
  return categories.find((category) => category === itemId) ?? null;
}
