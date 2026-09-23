// The detail column's view model for build 1, pure (docs/ui/encyclopedia.md §11.3): the breadcrumb both the landing
// and the entry area wear, and the landing's tiles. The entry page itself — the lens, the facts, the prose — is #373.

import { ENCYCLOPEDIA_TITLE } from '../encyclopedia-constants';
import { ENCYCLOPEDIA_CATEGORY_LABEL, type EncyclopediaCategory } from '../model/categories';
import type { ResolvedEntry, ResolvedFact, ResolvedGroup } from '../model/entry';
import type { EntryId } from '../model/entry-id';
import { encyclopediaTileTestId } from '../test-ids';

/** One crumb; `target` is the category it goes to, and `null` where the crumb is the page already shown. */
export interface EncyclopediaCrumb {
  readonly text: string;
  readonly target: EncyclopediaCategory | null;
}

/**
 * A landing's trail: `Encyclopedia › Cells & food`, as the reference frame draws it. Neither crumb is a link — the
 * root names no page of its own, and the category crumb *is* the page being read, so going there would change
 * nothing (§11.5).
 */
export function landingBreadcrumb(category: EncyclopediaCategory): readonly EncyclopediaCrumb[] {
  return [
    { text: ENCYCLOPEDIA_TITLE, target: null },
    { text: ENCYCLOPEDIA_CATEGORY_LABEL[category], target: null },
  ];
}

/**
 * An entry's trail: `Evolution › Metabolism`, the category it lives in and the group it sits under, as the reference
 * frames draw it. The category crumb is the one link — it goes back to the landing the reader came from, which a link
 * that switched categories may never have shown them. An ungrouped category (abilities, actions) has no second crumb.
 */
export function entryBreadcrumb(
  category: EncyclopediaCategory,
  groupLabel: string | null,
): readonly EncyclopediaCrumb[] {
  const categoryCrumb: EncyclopediaCrumb = { text: ENCYCLOPEDIA_CATEGORY_LABEL[category], target: category };
  if (groupLabel === null) return [categoryCrumb];
  return [categoryCrumb, { text: groupLabel, target: null }];
}

/** Between a fact's name and its value: `Opens: Nucleoid Coil`, `Never below: 20 mass`. */
const TILE_FACT_NAME_SEPARATOR = ': ';

/**
 * The tile's one line: the fact's name, then its value. A value alone says nothing of what it measures (`Mass decay`
 * over `20 mass`), and a **link** fact's text is nothing but another entry's title, so a stage tile would read
 * `Protocell` over `Nucleoid Coil`, two titles with no way to tell which is the tile's.
 */
function tileLineFor(headline: ResolvedFact | null): string | null {
  if (headline === null) return null;
  return `${headline.label}${TILE_FACT_NAME_SEPARATOR}${headline.text}`;
}

export interface EncyclopediaTile {
  readonly entryId: EntryId;
  readonly title: string;
  /** The entry's `facts[0]` as one line (§11.3); `null` on an entry with no fact, where the line is left out. */
  readonly fact: string | null;
  readonly testId: string;
}

/**
 * Every entry of the category, in list order, as a tile. `resolve` is the registry's against the live balance, passed
 * in so this file stays pure: a tile's one fact is `headline`, which is the entry's first fact already formatted, so
 * nothing here reads a number or decides how one reads.
 */
export function landingTilesFor(
  groups: readonly ResolvedGroup[],
  resolve: (entryId: EntryId) => ResolvedEntry,
): readonly EncyclopediaTile[] {
  return groups.flatMap((group) =>
    group.entries.map((link) => ({
      entryId: link.entryId,
      title: link.title,
      fact: tileLineFor(resolve(link.entryId).headline),
      testId: encyclopediaTileTestId(link.entryId),
    })),
  );
}
