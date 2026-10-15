// The era gate (docs/architecture/encyclopedia.md §12.4): a page about a later era's world is written ahead of the
// slice that turns that era on, and the registry holds it only while its era is in the shipped balance's
// `ERAS_IN_PLAY` (`isEraInPlay`), so the live encyclopedia shows nothing of the pool until the pool is played. A
// subject whose code kinds live in more than one era reads each kind's era from shared code's total table
// (`FOOD_KIND_ERA`), so a new kind cannot arrive without one; every other subject's pages are the dish's, which every
// game plays. Every later era's page is gated by this one rule.

import { FOOD_KIND, FOOD_KIND_ERA, isEraInPlay, type BalanceConfig, type GameEra } from '@evolution/shared';
import { ENTRY_SUBJECT, entryIdOf, type EntryId } from './entry-id';

/** The era of every page whose subject spans eras: one row per food kind, from `FOOD_KIND_ERA`. */
export const ENTRY_ERA: ReadonlyMap<EntryId, GameEra> = new Map(
  Object.values(FOOD_KIND).map((kind) => [entryIdOf(ENTRY_SUBJECT.food, kind), FOOD_KIND_ERA[kind]]),
);

/** True when `entryId`'s era is in `balance`'s `ERAS_IN_PLAY`: always for a dish page. */
export function isEntryInPlay(entryId: EntryId, balance: Pick<BalanceConfig, 'eras'>): boolean {
  const era = ENTRY_ERA.get(entryId);
  return era === undefined || isEraInPlay(era, balance);
}
