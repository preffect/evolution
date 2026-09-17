// The encyclopedia's own numbers (docs/CODE-STANDARDS.md §2): the values docs/ui/encyclopedia.md §11.7 owns, declared
// exactly once here. Ids live in `test-ids.ts`, category labels and order in `model/categories.ts` (§11.2), and every
// gameplay number is the shared balance read through `EncyclopediaContextService` — nothing here is a copy of one.
//
// Only the constants the core (#447) needs are declared; the panel (#448) adds §11.7's layout row and the keyboard
// (#449) its key codes as those slices land.

import { ENCYCLOPEDIA_CATEGORY, type EncyclopediaCategory } from './model/categories';

/** Back-stack depth (docs/ui/encyclopedia.md §11.7); the oldest location drops first. */
export const ENCYCLOPEDIA_HISTORY_MAX = 50;

/**
 * Where an open with nothing else asked for starts (docs/ui/encyclopedia.md §11.1): the rules every other page leans
 * on. While that category has no entry yet (#361), §11.5's empty-category rule sends the open to the first category
 * that does.
 */
export const DEFAULT_ENCYCLOPEDIA_CATEGORY: EncyclopediaCategory = ENCYCLOPEDIA_CATEGORY.basics;
