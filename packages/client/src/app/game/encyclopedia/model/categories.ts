// The encyclopedia's categories (docs/architecture/encyclopedia.md §12.2): the closed values are §12's, their labels
// and navigation order are docs/ui/encyclopedia.md §11.2's. An entry's category is derived from its subject, never
// written in content; `CATEGORY_BY_ENTRY` holds the one exception.

import type { ValueOf } from '@evolution/shared';
import { ENTRY_SUBJECT, splitEntryId, type EntryId, type EntrySubject } from './entry-id';

export const ENCYCLOPEDIA_CATEGORY = {
  /** The rules every other page leans on. */
  basics: 'basics',
  entities: 'entities',
  evolutions: 'evolutions',
  abilities: 'abilities',
  actions: 'actions',
  world: 'world',
} as const;
export type EncyclopediaCategory = ValueOf<typeof ENCYCLOPEDIA_CATEGORY>;

export const ENCYCLOPEDIA_CATEGORY_LABEL: Readonly<Record<EncyclopediaCategory, string>> = {
  [ENCYCLOPEDIA_CATEGORY.basics]: 'Basics',
  [ENCYCLOPEDIA_CATEGORY.entities]: 'Cells & food',
  [ENCYCLOPEDIA_CATEGORY.evolutions]: 'Evolution',
  [ENCYCLOPEDIA_CATEGORY.abilities]: 'Abilities',
  [ENCYCLOPEDIA_CATEGORY.actions]: 'Actions',
  [ENCYCLOPEDIA_CATEGORY.world]: 'World',
};

/**
 * The one line under a category's landing heading (docs/ui/encyclopedia.md §11.3): §11.2's "what a player finds
 * there", in the player's words. Copy, never a number — a landing that wants a figure links to the entry holding it.
 */
export const ENCYCLOPEDIA_CATEGORY_SUMMARY: Readonly<Record<EncyclopediaCategory, string>> = {
  [ENCYCLOPEDIA_CATEGORY.basics]: 'The rules every other page leans on, and how to read the screen.',
  [ENCYCLOPEDIA_CATEGORY.entities]: 'Who lives in the dish, what you swallow to grow, and where DNA comes from.',
  [ENCYCLOPEDIA_CATEGORY.evolutions]: 'The ladder stages, every trait and what its tiers do, and the DNA tags.',
  [ENCYCLOPEDIA_CATEGORY.abilities]: 'What a trait grants you, and which traits grant it.',
  [ENCYCLOPEDIA_CATEGORY.actions]: 'Everything you can do, and how each one resolves.',
  [ENCYCLOPEDIA_CATEGORY.world]: 'The dish and its zones, the clock, the bloom and the round.',
};

export const ENCYCLOPEDIA_CATEGORY_ORDER: readonly EncyclopediaCategory[] = [
  ENCYCLOPEDIA_CATEGORY.basics,
  ENCYCLOPEDIA_CATEGORY.entities,
  ENCYCLOPEDIA_CATEGORY.evolutions,
  ENCYCLOPEDIA_CATEGORY.abilities,
  ENCYCLOPEDIA_CATEGORY.actions,
  ENCYCLOPEDIA_CATEGORY.world,
];

export const CATEGORY_BY_SUBJECT: Readonly<Record<EntrySubject, EncyclopediaCategory>> = {
  [ENTRY_SUBJECT.concept]: ENCYCLOPEDIA_CATEGORY.basics,
  [ENTRY_SUBJECT.cellKind]: ENCYCLOPEDIA_CATEGORY.entities,
  [ENTRY_SUBJECT.food]: ENCYCLOPEDIA_CATEGORY.entities,
  [ENTRY_SUBJECT.bacterium]: ENCYCLOPEDIA_CATEGORY.entities,
  [ENTRY_SUBJECT.entity]: ENCYCLOPEDIA_CATEGORY.entities,
  [ENTRY_SUBJECT.stage]: ENCYCLOPEDIA_CATEGORY.evolutions,
  [ENTRY_SUBJECT.trait]: ENCYCLOPEDIA_CATEGORY.evolutions,
  [ENTRY_SUBJECT.dnaTag]: ENCYCLOPEDIA_CATEGORY.evolutions,
  [ENTRY_SUBJECT.ability]: ENCYCLOPEDIA_CATEGORY.abilities,
  [ENTRY_SUBJECT.action]: ENCYCLOPEDIA_CATEGORY.actions,
  [ENTRY_SUBJECT.zone]: ENCYCLOPEDIA_CATEGORY.world,
  [ENTRY_SUBJECT.world]: ENCYCLOPEDIA_CATEGORY.world,
};

/** The entries whose category is not their subject's: the food overview is a concept read beside the foods. */
export const CATEGORY_BY_ENTRY: Readonly<Partial<Record<EntryId, EncyclopediaCategory>>> = {
  'concept:food': ENCYCLOPEDIA_CATEGORY.entities,
};

export function categoryOf(entryId: EntryId): EncyclopediaCategory {
  return CATEGORY_BY_ENTRY[entryId] ?? CATEGORY_BY_SUBJECT[splitEntryId(entryId).subject];
}
